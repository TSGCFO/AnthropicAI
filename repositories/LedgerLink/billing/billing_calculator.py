# billing_calculator.py

from dataclasses import dataclass, field
from datetime import datetime
from decimal import Decimal
from typing import Dict, List, Optional, Union
import json
from django.core.exceptions import ValidationError
from django.db.models import Q
import logging

from orders.models import Order
from customers.models import Customer
from services.models import Service
from rules.models import Rule, RuleGroup
from customer_services.models import CustomerService

logger = logging.getLogger(__name__)


@dataclass
class ServiceCost:
    service_id: int
    service_name: str
    amount: Decimal


@dataclass
class OrderCost:
    order_id: int
    service_costs: List[ServiceCost] = field(default_factory=list)
    total_amount: Decimal = Decimal('0')


@dataclass
class BillingReport:
    customer_id: int
    start_date: datetime
    end_date: datetime
    order_costs: List[OrderCost] = field(default_factory=list)
    service_totals: Dict[int, Decimal] = field(default_factory=dict)
    total_amount: Decimal = Decimal('0')


def normalize_sku(sku: str) -> str:
    """
    Normalize SKU format for consistent comparison.
    Examples:
        'pack boxes' -> 'PACKBOXES'
        'TestSKU' -> 'TESTSKU'
        '6pack boxes' -> '6PACKBOXES'
        '  Pack  Boxes  ' -> 'PACKBOXES'
    """
    try:
        if not sku:
            return ''
        # Remove extra spaces and convert to uppercase
        return ''.join(str(sku).split()).upper()
    except (AttributeError, TypeError):
        return ''


def convert_sku_format(sku_data) -> Dict:
    """
    Convert SKU data from JSON array format to dictionary format
    Input format: [{"sku": "ABO-022", "quantity": 720}]
    Output format: {'ABO-022': 720}
    """
    try:
        if isinstance(sku_data, str):
            sku_data = json.loads(sku_data)

        if not isinstance(sku_data, list):
            logger.error(f"SKU data must be a list, got {type(sku_data)}")
            return {}

        sku_dict = {}
        for item in sku_data:
            if not isinstance(item, dict):
                logger.error(f"Each SKU item must be a dictionary, got {type(item)}")
                continue

            if 'sku' not in item or 'quantity' not in item:
                logger.error("SKU item missing required fields 'sku' or 'quantity'")
                continue

            # Normalize SKU format
            sku = normalize_sku(str(item['sku']))
            if not sku:
                logger.error("SKU cannot be empty")
                continue

            try:
                quantity = float(item['quantity'])
            except (TypeError, ValueError):
                logger.error(f"Invalid quantity for SKU {sku}: {item['quantity']}")
                continue

            if quantity <= 0:
                logger.error(f"Invalid quantity {quantity} for SKU {sku}")
                continue

            # If the same SKU appears multiple times (with different formats),
            # add the quantities together
            sku_dict[sku] = sku_dict.get(sku, 0) + quantity

        return sku_dict
    except (json.JSONDecodeError, TypeError, KeyError) as e:
        logger.error(f"Error converting SKU format: {str(e)}")
        return {}


def validate_sku_quantity(sku_data) -> bool:
    """Validate SKU quantity data format and content."""
    try:
        if isinstance(sku_data, str):
            sku_data = json.loads(sku_data)

        if not isinstance(sku_data, list):
            return False

        # Convert to dictionary
        sku_dict = convert_sku_format(sku_data)
        if not sku_dict:
            return False

        # Validate the converted dictionary
        for sku, quantity in sku_dict.items():
            if not isinstance(sku, str) or not sku.strip():
                return False

            try:
                qty = float(quantity)
                if qty <= 0:
                    return False
            except (TypeError, ValueError):
                return False

        return True
    except Exception as e:
        logger.error(f"Error validating SKU quantity: {str(e)}")
        return False


class RuleEvaluator:
    @staticmethod
    def evaluate_rule(rule: Rule, order: Order) -> bool:
        try:
            field_value = getattr(order, rule.field, None)
            if field_value is None:
                logger.warning(f"Field {rule.field} not found in order {order.transaction_id}")
                return False

            values = rule.get_values_as_list()

            # Handle numeric fields
            numeric_fields = ['weight_lb', 'line_items', 'total_item_qty', 'volume_cuft', 'packages']
            if rule.field in numeric_fields:
                try:
                    field_value = float(field_value) if field_value is not None else 0
                    value = float(values[0]) if values else 0

                    if rule.operator == 'gt':
                        return field_value > value
                    elif rule.operator == 'lt':
                        return field_value < value
                    elif rule.operator == 'eq':
                        return field_value == value
                    elif rule.operator == 'ne':
                        return field_value != value
                    elif rule.operator == 'ge':
                        return field_value >= value
                    elif rule.operator == 'le':
                        return field_value <= value
                except (ValueError, TypeError):
                    logger.error(f"Error converting numeric values for field {rule.field}")
                    return False

            # Handle string fields
            string_fields = ['reference_number', 'ship_to_name', 'ship_to_company',
                             'ship_to_city', 'ship_to_state', 'ship_to_country',
                             'carrier', 'notes']
            if rule.field in string_fields:
                field_value = str(field_value) if field_value is not None else ''

                if rule.operator == 'eq':
                    return field_value == values[0]
                elif rule.operator == 'ne':
                    return field_value != values[0]
                elif rule.operator == 'in':
                    return field_value in values
                elif rule.operator == 'ni':
                    return field_value not in values
                elif rule.operator == 'contains':
                    return any(v in field_value for v in values)
                elif rule.operator == 'ncontains':
                    return not any(v in field_value for v in values)
                elif rule.operator == 'startswith':
                    return any(field_value.startswith(v) for v in values)
                elif rule.operator == 'endswith':
                    return any(field_value.endswith(v) for v in values)

            # Handle SKU quantity
            if rule.field == 'sku_quantity':
                if field_value is None:
                    return False

                try:
                    if isinstance(field_value, str):
                        field_value = json.loads(field_value)

                    if not validate_sku_quantity(field_value):
                        return False

                    # Extract SKUs for comparison
                    sku_dict = convert_sku_format(field_value)
                    # Normalize SKUs for comparison
                    skus = [normalize_sku(sku) for sku in sku_dict.keys()]

                    if rule.operator == 'contains':
                        return any(normalize_sku(v) in skus for v in values)
                    elif rule.operator == 'ncontains':
                        return not any(normalize_sku(v) in skus for v in values)
                    elif rule.operator == 'in':
                        return any(normalize_sku(v) in str(sku_dict) for v in values)
                    elif rule.operator == 'ni':
                        return not any(normalize_sku(v) in str(sku_dict) for v in values)
                except (json.JSONDecodeError, AttributeError):
                    logger.error(f"Error processing SKU quantity")
                    return False

            logger.warning(f"Unhandled field {rule.field} or operator {rule.operator}")
            return False

        except Exception as e:
            logger.error(f"Error evaluating rule: {str(e)}")
            return False

    @staticmethod
    def evaluate_rule_group(rule_group: RuleGroup, order: Order) -> bool:
        try:
            rules = rule_group.rules.all()
            if not rules:
                logger.warning(f"No rules found in rule group {rule_group.id}")
                return False

            results = [RuleEvaluator.evaluate_rule(rule, order) for rule in rules]

            if rule_group.logic_operator == 'AND':
                return all(results)
            elif rule_group.logic_operator == 'OR':
                return any(results)
            elif rule_group.logic_operator == 'NOT':
                return not any(results)
            elif rule_group.logic_operator == 'XOR':
                return sum(results) == 1
            elif rule_group.logic_operator == 'NAND':
                return not all(results)
            elif rule_group.logic_operator == 'NOR':
                return not any(results)

            logger.warning(f"Unknown logic operator {rule_group.logic_operator}")
            return False

        except Exception as e:
            logger.error(f"Error evaluating rule group: {str(e)}")
            return False


class BillingCalculator:
    def __init__(self, customer_id: int, start_date: datetime, end_date: datetime):
        self.customer_id = customer_id
        self.start_date = start_date
        self.end_date = end_date
        self.report = BillingReport(customer_id, start_date, end_date)

    def validate_input(self) -> None:
        """Validate input parameters"""
        try:
            try:
                customer = Customer.objects.get(id=self.customer_id)
            except Customer.DoesNotExist:
                raise ValidationError(f"Customer with ID {self.customer_id} not found")

            if self.start_date > self.end_date:
                raise ValidationError("Start date must be before or equal to end date")

            if not CustomerService.objects.filter(customer_id=self.customer_id).exists():
                raise ValidationError(f"No services found for customer {self.customer_id}")

        except Exception as e:
            logger.error(f"Validation error: {str(e)}")
            raise

    def calculate_service_cost(self, customer_service: CustomerService, order: Order) -> Decimal:
        """Calculate the cost for a service"""
        try:
            if not customer_service.unit_price:
                logger.warning(f"No unit price set for customer service {customer_service}")
                return Decimal('0')

            base_price = customer_service.unit_price
            service_name = customer_service.service.service_name.lower()

            # Handle SKU-specific quantity-based services
            if customer_service.service.charge_type == 'quantity':
                # Get assigned SKUs and normalize them
                assigned_skus = {normalize_sku(sku) for sku in customer_service.get_sku_list()}

                # If service has assigned SKUs, only calculate for those specific SKUs
                if assigned_skus:
                    try:
                        sku_quantity = getattr(order, 'sku_quantity', None)
                        if sku_quantity is None:
                            logger.warning(f"No sku_quantity found for order {order.transaction_id}")
                            return Decimal('0')

                        sku_dict = convert_sku_format(sku_quantity)
                        if not sku_dict:
                            logger.error(f"Invalid SKU quantity format for order {order.transaction_id}")
                            return Decimal('0')

                        # Calculate total quantity for matching SKUs
                        matched_skus = {}
                        original_skus = {}  # Keep track of original SKU formats
                        total_quantity = Decimal('0')

                        # Log SKU matching details for debugging
                        matching_details = []

                        for sku, quantity in sku_dict.items():
                            normalized_sku = normalize_sku(sku)
                            if normalized_sku in assigned_skus:
                                matched_skus[normalized_sku] = quantity
                                original_skus[normalized_sku] = sku  # Store original format
                                total_quantity += Decimal(str(quantity))
                                matching_details.append(
                                    f"Matched: Order SKU '{sku}' with normalized form '{normalized_sku}'"
                                )
                            else:
                                matching_details.append(
                                    f"No match: Order SKU '{sku}' with normalized form '{normalized_sku}'"
                                )

                        # Detailed logging for debugging
                        logger.info(
                            f"SKU-specific service calculation for {service_name} "
                            f"(Service ID: {customer_service.service.id}):\n"
                            f"- Customer Service ID: {customer_service.id}\n"
                            f"- Base Price: ${base_price}\n"
                            f"- Assigned SKUs (normalized): {sorted(assigned_skus)}\n"
                            f"- Order SKUs (original): {sorted(sku_dict.keys())}\n"
                            f"- Matching Details:\n  " + "\n  ".join(matching_details) + "\n"
                                                                                         f"- Matched SKUs: {matched_skus}\n"
                                                                                         f"- Original SKU formats: {original_skus}\n"
                                                                                         f"- Total Quantity: {total_quantity}\n"
                                                                                         f"- Calculated Cost: ${base_price * total_quantity}"
                        )

                        if not matched_skus:
                            logger.info(f"No matching SKUs found for service {service_name} in order {order.transaction_id}")
                            return Decimal('0')

                        return base_price * total_quantity

                    except Exception as e:
                        logger.error(
                            f"Error processing SKU-specific quantity calculation for service "
                            f"{service_name} (Service ID: {customer_service.service.id}) "
                            f"in order {order.transaction_id}: {str(e)}"
                        )
                        return Decimal('0')

                # Handle Pick Cost and Case Pick services
                elif service_name in ['pick cost', 'case pick']:
                    try:
                        from products.models import Product

                        # Get all SKUs assigned to quantity-based services
                        excluded_skus = set()
                        for cs in CustomerService.objects.filter(
                                customer_id=order.customer_id,
                                service__charge_type='quantity'
                        ).exclude(skus=None):
                            excluded_skus.update(normalize_sku(sku) for sku in cs.get_sku_list())

                        sku_quantity = getattr(order, 'sku_quantity', None)
                        if sku_quantity is None:
                            logger.warning(f"No sku_quantity found for order {order.transaction_id}")
                            return Decimal('0')

                        sku_dict = convert_sku_format(sku_quantity)
                        if not sku_dict:
                            logger.error(f"Invalid SKU quantity format for order {order.transaction_id}")
                            return Decimal('0')

                        # Filter out SKUs that are assigned to quantity-based services
                        filtered_sku_dict = {
                            sku: quantity
                            for sku, quantity in sku_dict.items()
                            if normalize_sku(sku) not in excluded_skus
                        }

                        if not filtered_sku_dict:
                            logger.info(f"No applicable SKUs for {service_name} after filtering")
                            return Decimal('0')

                        total_cost = Decimal('0')
                        calculation_details = []

                        for sku, quantity in filtered_sku_dict.items():
                            try:
                                product = Product.objects.get(
                                    sku=sku,
                                    customer_id=order.customer_id
                                )

                                case_size = None
                                if (product.labeling_unit_1 and
                                        product.labeling_unit_1.lower() == 'case' and
                                        product.labeling_quantity_1):
                                    case_size = product.labeling_quantity_1

                                if service_name == 'case pick':
                                    if case_size:
                                        cases = quantity // case_size
                                        if cases > 0:
                                            case_cost = base_price * Decimal(str(cases))
                                            total_cost += case_cost
                                            calculation_details.append(
                                                f"SKU {sku}:\n"
                                                f"  - Quantity: {quantity}\n"
                                                f"  - Case size: {case_size}\n"
                                                f"  - Full cases: {cases}\n"
                                                f"  - Cost: ${case_cost}"
                                            )
                                else:  # pick cost
                                    if case_size:
                                        remaining_units = quantity % case_size
                                        if remaining_units > 0:
                                            unit_cost = base_price * Decimal(str(remaining_units))
                                            total_cost += unit_cost
                                            calculation_details.append(
                                                f"SKU {sku}:\n"
                                                f"  - Quantity: {quantity}\n"
                                                f"  - Remaining units: {remaining_units}\n"
                                                f"  - Cost: ${unit_cost}"
                                            )
                                    else:
                                        unit_cost = base_price * Decimal(str(quantity))
                                        total_cost += unit_cost
                                        calculation_details.append(
                                            f"SKU {sku}:\n"
                                            f"  - Quantity: {quantity}\n"
                                            f"  - Cost: ${unit_cost}"
                                        )

                            except Product.DoesNotExist:
                                logger.warning(f"Product not found for SKU {sku}")
                                continue

                        logger.info(
                            f"{service_name} calculation details:\n"
                            f"- Original SKUs: {sku_dict}\n"
                            f"- Excluded SKUs: {excluded_skus}\n"
                            f"- Filtered SKUs: {filtered_sku_dict}\n"
                            f"- Calculations:\n{chr(10).join(calculation_details)}\n"
                            f"- Total cost: ${total_cost}"
                        )

                        return total_cost

                    except Exception as e:
                        logger.error(f"Error processing {service_name}: {str(e)}")
                        return Decimal('0')

                # Handle SKU Cost service
                elif service_name == 'sku cost':
                    try:
                        sku_quantity = getattr(order, 'sku_quantity', None)
                        if sku_quantity is None:
                            return Decimal('0')

                        sku_dict = convert_sku_format(sku_quantity)
                        if not sku_dict:
                            return Decimal('0')

                        unique_sku_count = len(sku_dict.keys())
                        return base_price * Decimal(str(unique_sku_count))

                    except Exception as e:
                        logger.error(f"Error processing SKU Cost: {str(e)}")
                        return Decimal('0')

                # Regular quantity-based service without specific SKUs
                else:
                    quantity = getattr(order, 'total_item_qty', 1)
                    if quantity is None:
                        quantity = 1
                    return base_price * Decimal(str(quantity))

            # Handle single charge type
            elif customer_service.service.charge_type == 'single':
                return base_price

            logger.warning(f"Unknown charge type {customer_service.service.charge_type}")
            return Decimal('0')

        except Exception as e:
            logger.error(f"Error calculating service cost: {str(e)}")
            return Decimal('0')

    def generate_report(self) -> BillingReport:
        """Generate the billing report"""
        try:
            self.validate_input()

            orders = Order.objects.filter(
                customer_id=self.customer_id,
                close_date__range=(self.start_date, self.end_date)
            ).select_related('customer')

            if not orders:
                logger.info(f"No orders found for customer {self.customer_id} in date range")
                return self.report

            customer_services = CustomerService.objects.filter(
                customer_id=self.customer_id
            ).select_related('service')

            for order in orders:
                try:
                    order_cost = OrderCost(order_id=order.transaction_id)
                    applied_single_services = set()

                    for cs in customer_services:
                        if cs.service.charge_type == 'single' and cs.service.id in applied_single_services:
                            continue

                        rule_groups = RuleGroup.objects.filter(customer_service=cs)
                        service_applies = False

                        if not rule_groups.exists():
                            service_applies = True  # If no rules, service always applies
                        else:
                            for rule_group in rule_groups:
                                if RuleEvaluator.evaluate_rule_group(rule_group, order):
                                    service_applies = True
                                    break

                        if service_applies:
                            cost = self.calculate_service_cost(cs, order)

                            service_cost = ServiceCost(
                                service_id=cs.service.id,
                                service_name=cs.service.service_name,
                                amount=cost
                            )
                            order_cost.service_costs.append(service_cost)
                            order_cost.total_amount += cost

                            self.report.service_totals[cs.service.id] = (
                                    self.report.service_totals.get(cs.service.id, Decimal('0')) + cost
                            )

                            if cs.service.charge_type == 'single':
                                applied_single_services.add(cs.service.id)

                    self.report.order_costs.append(order_cost)
                    self.report.total_amount += order_cost.total_amount

                except Exception as e:
                    logger.error(f"Error processing order {order.transaction_id}: {str(e)}")
                    continue

            return self.report

        except Exception as e:
            logger.error(f"Error generating report: {str(e)}")
            raise

    # In billing_calculator.py, update the to_dict method
    def to_dict(self) -> dict:
        """Convert the report to a dictionary format"""
        try:
            service_names = {}  # Create a mapping of service IDs to names
            for oc in self.report.order_costs:
                for sc in oc.service_costs:
                    service_names[sc.service_id] = sc.service_name
    
            return {
                'customer_id': self.report.customer_id,
                'start_date': self.report.start_date.isoformat(),
                'end_date': self.report.end_date.isoformat(),
                'orders': [
                    {
                        'order_id': oc.order_id,
                        'services': [
                            {
                                'service_id': sc.service_id,
                                'service_name': sc.service_name,
                                'amount': str(sc.amount)
                            }
                            for sc in oc.service_costs
                        ],
                        'total_amount': str(oc.total_amount)
                    }
                    for oc in self.report.order_costs
                ],
                'service_totals': {
                    service_id: {
                        'name': service_names.get(service_id, f'Service {service_id}'),
                        'amount': str(amount)
                    }
                    for service_id, amount in self.report.service_totals.items()
                },
                'total_amount': str(self.report.total_amount)
            }
        except Exception as e:
            logger.error(f"Error converting report to dict: {str(e)}")
            raise

    def to_json(self) -> str:
        """Convert the report to JSON format"""
        try:
            return json.dumps(self.to_dict(), indent=2)
        except Exception as e:
            logger.error(f"Error converting report to JSON: {str(e)}")
            raise

    def to_csv(self) -> str:
        """Convert the report to CSV format"""
        try:
            lines = [
                "Order ID,Service ID,Service Name,Amount",
            ]

            for order_cost in self.report.order_costs:
                for service_cost in order_cost.service_costs:
                    lines.append(
                        f"{order_cost.order_id},"
                        f"{service_cost.service_id},"
                        f"{service_cost.service_name},"
                        f"{service_cost.amount}"
                    )

            return "\n".join(lines)
        except Exception as e:
            logger.error(f"Error converting report to CSV: {str(e)}")
            raise


def generate_billing_report(
        customer_id: int,
        start_date: Union[datetime, str],
        end_date: Union[datetime, str],
        output_format: str = 'json'
) -> str:
    """Generate a billing report for the specified customer and date range."""
    try:
        logger.info(f"Generating report for customer {customer_id} from {start_date} to {end_date}")

        if isinstance(start_date, str):
            start_date = datetime.fromisoformat(start_date.replace('Z', '+00:00'))
        if isinstance(end_date, str):
            end_date = datetime.fromisoformat(end_date.replace('Z', '+00:00'))

        calculator = BillingCalculator(customer_id, start_date, end_date)
        calculator.generate_report()

        if output_format.lower() == 'csv':
            return calculator.to_csv()
        return calculator.to_json()

    except Exception as e:
        logger.error(f"Error in generate_billing_report: {str(e)}")
        raise