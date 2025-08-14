export function init(elem, container) {
    elem.focus();

    // Auto-resize whenever the user types or if the value is set programmatically
    elem.addEventListener('input', () => resizeToFit(elem));
    afterPropertyWritten(elem, 'value', () => resizeToFit(elem));

    // Auto-submit the form on 'enter' keypress
    elem.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            elem.dispatchEvent(new CustomEvent('change', { bubbles: true }));
            elem.closest('form').dispatchEvent(new CustomEvent('submit', { bubbles: true, cancelable: true }));
        }
    });

    // Add drag and drop functionality
    setupDragAndDrop(container, elem)
}

function resizeToFit(elem) {
    const lineHeight = parseFloat(getComputedStyle(elem).lineHeight);

    elem.rows = 1;
    const numLines = Math.ceil(elem.scrollHeight / lineHeight);
    elem.rows = Math.min(5, Math.max(1, numLines));
}

function afterPropertyWritten(target, propName, callback) {
    const descriptor = getPropertyDescriptor(target, propName);
    Object.defineProperty(target, propName, {
        get: function () {
            return descriptor.get.apply(this, arguments);
        },
        set: function () {
            const result = descriptor.set.apply(this, arguments);
            callback();
            return result;
        }
    });
}

function getPropertyDescriptor(target, propertyName) {
    return Object.getOwnPropertyDescriptor(target, propertyName)
        || getPropertyDescriptor(Object.getPrototypeOf(target), propertyName);
}

function setupDragAndDrop(container, textArea) {
    let dragOverCount = 0;

    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        container.addEventListener(eventName, e => {
            e.preventDefault();
            e.stopPropagation();
        }, false);
    });

    ['dragenter', 'dragover'].forEach(eventName => {
        container.addEventListener(eventName, () => {
            dragOverCount++;
            container.classList.add('drag-over');
        }, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        container.addEventListener(eventName, () => {
            dragOverCount--;
            if (dragOverCount === 0) {
                container.classList.remove('drag-over');
            }
        }, false);
    });

    container.addEventListener('drop', async (e) => {
        dragOverCount = 0;
        container.classList.remove('drag-over');

        const files = e.dataTransfer.files;
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            if (file.type.startsWith('image/')) {
                try {
                    const reader = new FileReader();
                    reader.onload = async () => {
                        const base64 = reader.result.split(',')[1];
                        await uploadImageAndUpdateTextArea(file.name, base64, file.type, textArea);
                    };
                    reader.readAsDataURL(file);
                } catch (error) {
                    console.error('Error processing image:', error);
                }
            }
        }
    }, false);
}

async function uploadImageAndUpdateTextArea(fileName, base64Data, contentType, textArea) {
    try {
        const response = await fetch('/api/images', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                base64Data: base64Data,
                contentType: contentType,
                fileName: fileName
            })
        });

        if (response.ok) {
            const result = await response.json();
            const markdownText = `![${fileName}](${result.imageUri})`;
            const currentValue = textArea.value || '';
            // can we insert at the cursor position?
            const newValue = currentValue.length > 0 ? `${currentValue}${markdownText}` : markdownText;

            textArea.value = newValue;
            textArea.dispatchEvent(new CustomEvent('input', { bubbles: true }));
            textArea.dispatchEvent(new CustomEvent('change', { bubbles: true }));
            resizeToFit(textArea);
        } else {
            console.error('Failed to upload image:', response.statusText);
        }
    } catch (error) {
        console.error('Error uploading image:', error);
    }
}