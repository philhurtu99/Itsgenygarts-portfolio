export function paidAtFromStripeObject(stripeObject) {
  return stripeObject?.created
    ? new Date(stripeObject.created * 1000)
    : new Date();
}

export function stripeObjectId(value) {
  return typeof value === 'object' && value !== null ? value.id : value;
}

export function orderCustomerUpdateFromStripeSession(stripeObject) {
  const customer = stripeObject?.customer_details || {};
  const shipping = stripeObject?.shipping_details || {};
  const address = shipping.address || customer.address || {};
  const email = customer.email || stripeObject?.customer_email;
  const data = {};

  if (customer.name || shipping.name) data.customerName = customer.name || shipping.name;
  if (email) data.customerEmail = String(email).trim().toLowerCase();
  if (customer.phone) data.customerPhone = customer.phone;
  if (address.line1 || address.line2) data.customerAddress = [address.line1, address.line2].filter(Boolean).join(', ');
  if (address.city) data.customerCity = address.city;
  if (address.state) data.customerProvince = address.state;
  if (address.postal_code) data.customerPostalCode = address.postal_code;
  if (address.country) data.customerCountry = address.country;

  return data;
}

export function paidOrderUpdateFromStripeSession(stripeObject) {
  return {
    status: 'PAID',
    stripePaymentId: stripeObjectId(stripeObject?.payment_intent) || stripeObject?.id || null,
    paidAt: paidAtFromStripeObject(stripeObject),
    ...orderCustomerUpdateFromStripeSession(stripeObject),
  };
}
