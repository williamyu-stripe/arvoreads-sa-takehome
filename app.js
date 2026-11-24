const express = require('express');
const path = require('path');
const { engine } = require('express-handlebars');
require('dotenv').config();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

var app = express();

// view engine setup (Handlebars)
app.engine('hbs', engine({
  defaultLayout: 'main',
  extname: '.hbs'
}));
app.set('view engine', 'hbs');
app.use(express.static(path.join(__dirname, 'public')));

/**
 * Webhook route
 * Stripe calls this when a payment succeeds, even if the customer closed the tab
 * before reaching /success. It must be registered before express.json() because
 * the signature check needs the raw, unparsed request body.
 */
app.post('/webhook', express.raw({ type: 'application/json' }), function(req, res) {
  let event;

  try {
    // Proves the request came from Stripe and wasn't changed on the way
    event = stripe.webhooks.constructEvent(
      req.body,
      req.headers['stripe-signature'],
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error('Webhook signature check failed:', err.message);
    return res.status(400).send('Webhook Error: ' + err.message);
  }

  switch (event.type) {
    case 'payment_intent.succeeded': {
      const paymentIntent = event.data.object;
      // This is where fulfilment would go, e.g. emailing a download link for the book
      console.log('Payment succeeded:', paymentIntent.id,
        paymentIntent.amount, paymentIntent.currency,
        paymentIntent.metadata.title, paymentIntent.metadata.customer_email);
      break;
    }
    default:
      console.log('Unhandled event type:', event.type);
  }

  // Reply quickly so Stripe doesn't retry the event
  res.json({ received: true });
});

app.use(express.urlencoded({ extended: true }))
app.use(express.json({}));

/**
 * Home route
 */
app.get('/', function(req, res) {
  res.render('index');
});

/**
 * Checkout route
 */
app.get('/checkout', async function(req, res) {
  // Just hardcoding amounts here to avoid using a database
  const item = req.query.item;
  let title, amount, error, clientSecret;

  switch (item) {
    case '1':
      title = "The Art of Doing Science and Engineering"
      amount = 2300      
      break;
    case '2':
      title = "The Making of Prince of Persia: Journals 1985-1993"
      amount = 2500
      break;     
    case '3':
      title = "Working in Public: The Making and Maintenance of Open Source"
      amount = 2800  
      break;     
    default:
      // Included in layout view, feel free to assign error
      error = "No item selected"
      break;
  }

  // Create the PaymentIntent server-side for the chosen book.
  // Return its client_secret, where the Payment Element uses it.
  if (!error) {
    try {
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: 'usd',
        automatic_payment_methods: { enabled: true },
        metadata: { item: item, title: title }
      });
      clientSecret = paymentIntent.client_secret;
    } catch (err) {
      console.error(err);
      error = "We couldn't start the payment. Please try again.";
    }
  }

  res.render('checkout', {
    title: title,
    amount: amount,
    error: error,
    clientSecret: clientSecret,
    publishableKey: process.env.STRIPE_PUBLISHABLE_KEY
  });
});

/**
 * Save the customer's email on the PaymentIntent before it is confirmed.
 * Metadata needs the secret key, so the browser calls this route rather than Stripe.
 */
app.post('/payment-intent/email', async function(req, res) {
  const { clientSecret, email } = req.body;

  if (!clientSecret || !email) {
    return res.status(400).json({ error: "Missing payment or email" });
  }

  try {
    // The client_secret is "pi_..._secret_...". Checking the full secret, not just the ID,
    // means only the page that owns this payment can change it.
    const paymentIntentId = clientSecret.split('_secret_')[0];
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

    if (paymentIntent.client_secret !== clientSecret) {
      return res.status(403).json({ error: "Payment not found" });
    }

    await stripe.paymentIntents.update(paymentIntentId, {
      metadata: { customer_email: email }
    });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "We couldn't save your email. Please try again." });
  }
});

/**
 * Success route
 */
app.get('/success', async function(req, res) {
  // Stripe adds ?payment_intent=pi_... to the return_url after confirmPayment
  const paymentIntentId = req.query.payment_intent;

  if (!paymentIntentId) {
    return res.render('success', { error: "No payment found" });
  }

  // Retrieve the PaymentIntent server-side rather than trusting the URL, so the
  // amount and status shown come straight from Stripe
  try {
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

    if (paymentIntent.status !== 'succeeded') {
      return res.render('success', {
        error: "Your payment hasn't completed (status: " + paymentIntent.status + ")"
      });
    }

    res.render('success', {
      paymentIntentId: paymentIntent.id,
      amount: paymentIntent.amount,
      currency: paymentIntent.currency.toUpperCase(),
      title: paymentIntent.metadata.title,
      receiptEmail: paymentIntent.receipt_email
    });
  } catch (err) {
    console.error(err);
    res.render('success', { error: "We couldn't find that payment" });
  }
});

/**
 * Start server
 */
app.listen(3000, () => {
  console.log('Getting served on port 3000');
});
