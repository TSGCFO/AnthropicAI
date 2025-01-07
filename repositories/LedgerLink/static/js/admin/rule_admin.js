document.addEventListener('DOMContentLoaded', function() {
    // Field type dependent value input handling
    const fieldSelect = document.querySelector('#id_field');
    if (fieldSelect) {
        fieldSelect.addEventListener('change', function() {
            updateValueField(this.value);
        });

        // Initial setup
        updateValueField(fieldSelect.value);
    }

    function updateValueField(fieldType) {
        const valueInput = document.querySelector('#id_value');
        if (!valueInput) return;

        switch(fieldType) {
            case 'quantity':
            case 'weight':
            case 'volume':
                valueInput.type = 'number';
                valueInput.step = '0.01';
                break;
            case 'date':
                valueInput.type = 'date';
                break;
            default:
                valueInput.type = 'text';
        }
    }
});