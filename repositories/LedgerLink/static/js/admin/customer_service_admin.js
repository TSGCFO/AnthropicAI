django.jQuery(function($) {
    var skusField = $('#id_skus_from, #id_skus_to');
    var customerField = $('#id_customer');

    function updateSkus() {
        var customerId = customerField.val();
        if (!customerId) {
            skusField.empty();
            return;
        }

        // Show loading state
        skusField.html('<option>Loading SKUs...</option>');

        // Fetch SKUs for the selected customer
        $.ajax({
            url: '/customer_services/api/customer-skus/' + customerId + '/',
            method: 'GET',
            success: function(data) {
                // Clear the current options
                skusField.empty();

                // Add the new options
                data.forEach(function(sku) {
                    skusField.append(
                        $('<option></option>')
                            .attr('value', sku.id)
                            .text(sku.sku)
                    );
                });

                // Refresh the SelectFilter if it exists
                if (typeof SelectFilter !== 'undefined') {
                    SelectFilter.init('id_skus', 'SKUs', 0, '/static/admin/');
                }
            },
            error: function() {
                skusField.html('<option>Error loading SKUs</option>');
            }
        });
    }

    // Update SKUs when customer changes
    customerField.on('change', updateSkus);

    // Initial load if customer is pre-selected
    if (customerField.val()) {
        updateSkus();
    }
});