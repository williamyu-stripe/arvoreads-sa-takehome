## How to build, configure and run your application##

### Prerequisites

- Node.js 22.23.3 or later (`express-handlebars` 9 requires it). Check with `node -v`.
- A Stripe account in test mode, with your API keys from the developer console. 
- The [Stripe CLI](https://docs.stripe.com/stripe-cli), to test the webhook locally (optional).

### Install and configure

1. Clone the repo and install dependencies:
   `npm install`
2. Copy `sample.env` to `.env` and add the test keys:
   - `STRIPE_SECRET_KEY` (starts with `sk_test_`)
   - `STRIPE_PUBLISHABLE_KEY` (starts with `pk_test_`)
   - `STRIPE_WEBHOOK_SECRET` (starts with `whsec_`, only needed for the webhook)

### Run

- `npm start` runs the server.
- `npm run dev` runs it with auto-restart when `app.js` changes.
- Open http://localhost:3000, choose a book and pay with a [test card](https://docs.stripe.com/testing):
  - Success: `4242 4242 4242 4242`
  - Declined: `4000 0000 0000 0002`
  - 3D Secure: `4000 0027 6000 3184`
  - Use any future expiry date, any CVC and any postcode.

### Test the webhook (optional)

1. `stripe login`
2. `stripe listen --events payment_intent.succeeded --forward-to localhost:3000/webhook`
3. Copy the `whsec_...` secret it prints into `.env` and restart the server.
4. Make a test payment. The server logs `Payment succeeded: pi_...`.

## How does the solution work? Which Stripe APIs does it use? How is your application architected?##


The email brief asks for Stripe Elements on the front end, so the checkout uses the [Payment Element](https://docs.stripe.com/payments/payment-element). On the back end, the Express server uses the [Payment Intents API](https://docs.stripe.com/payments/payment-intents). The design follows Stripe's documented [intent-first integration](https://docs.stripe.com/payments/accept-a-payment-intent-first), which includes a diagram of the flow.
The Checkout Sessions API also works with the Payment Element, and Stripe recommends it for most new integrations. It fits better when a business needs more than a payment, such as Stripe Tax, discounts, shipping or subscriptions.


### Flow

1. When the checkout page loads, the server creates a PaymentIntent for the chosen book. The server sets the amount, so the browser can't change the price.
2. The server passes the PaymentIntent's client secret and the publishable key to the page. The secret key stays on the server.
3. The Payment Element collects the payment details. Card details go straight from the browser to Stripe.
4. When the buyer clicks Pay button, the server saves the email on the PaymentIntent, then `stripe.confirmPayment()` confirms the payment and runs 3D Secure if needed.
5. Stripe redirects to `/success`. The server retrieves the PaymentIntent and shows the amount and `pi_` ID only if the status is `succeeded`.
6. Stripe also sends a `payment_intent.succeeded` webhook, which arrives even if the buyer closes the tab.

### Architecture

The solution architecture follows a pattern Stripe recommends: https://docs.stripe.com/payments/accept-a-payment-intent-first#create-intent



## How did you approach this problem? Which docs did you use to complete the project? What challenges did you encounter?##

I built the app in VS Code with Claude Code. I chose not to ask the AI to build everything in one go. Instead, I worked through it one step at a time so I understood each part of the payment flow before moving on. The AI helped most with Node.js syntax and with tracking down dependency problems, and I checked each change by running and testing it.

Steps to complete the project

1. Upon installation of the project, npm warned deprecated package(`inflight` and `glob@7`). I used LLM to update Node to the right version: current 22.x release, then install express-handlebars@9. I also upgraded `stripe` from 8 to 23 to use the Payment Element, removed the unused `path` package, and updated `app.js` for the new `express-handlebars` API.

2. Added an `npm run dev` script (`node --watch app.js`) and ran it to inspect the existing site.

3. Modified `app.js` so that when the checkout page loads, the server creates a PaymentIntent for the chosen book and passes its client secret to the page.

4. Modified `views/checkout.hbs` to add a container for the Payment Element and pass the client secret and publishable key to the page. Stripe.js is loaded on every page from `views/layouts/main.hbs`. 

5. Created `public/js/checkout.js`. It mounts the Payment Element, when pay is clicked in a browser, it calls stripe and passes the email for the receipt. If the payment succeeds, Stripe sends the buyer to the success page. If it fails, the error appears under the form.

6. Modified `app.js` and `views/success.hbs`. The success page retrieves the PaymentIntent from Stripe using the ID in the redirect URL, and displays the transaction details when i`succeeded`. 

7. After inspecting the stripe dashboard, it seems transactions don't record customer email as default. Stripe.js (publishable key) can't set metadata; only the secret key can, so it must happen on the server. The PaymentIntent is created when the checkout page loads, before the customer types their email. 
 So I used AI to create a `POST /payment-intent/email` route that updates the metadata just before the payment is confirmed. 


8. Added a payment_intent.succeeded webhook for future integration work,

9. Tested the end-to-end processing using Stripe test cards. 

### Docs used

- [Create a PaymentIntent before collecting payment details](https://docs.stripe.com/payments/accept-a-payment-intent-first)
- [The Payment Intents API](https://docs.stripe.com/payments/payment-intents)
- [Payment Element](https://docs.stripe.com/payments/payment-element)
- [Receive Stripe events in your webhook endpoint](https://docs.stripe.com/webhooks)
- [Testing](https://docs.stripe.com/testing)

### Challenges

- **Outdated dependencies.** The boilerplate's packages were from 2021. Fixing the deprecation warnings needed a newer `express-handlebars`, which needed a newer Node.js, and its API had changed.
- **Saving the email.** The PaymentIntent exists before the buyer types their email, and only the secret key can update it, so this needed a server route that runs just before the payment is confirmed.
- **Stripe CLI changes.** Newer versions of `stripe listen` require `--events`, which older guides don't show.

## How you might extend this if you were building a more robust instance of the same application.## 
1. Extract the product catalogue out of the code as a seperate file/database so one change updates the whooe sites. Also add quantities and a cart. 
2. Use Checkout Session APIs to showcase more Stripe products. 
3. Use webhooks for different use cases such as fulfilment
4. Use Stripe Projects to create full page or embedded app. 




# Take home project
This is a simple e-commerce application that a customer can use to purchase a book, but it's missing the payments functionality —  your goal is to integrate Stripe to get this application running!




## Candidate instructions
You'll receive these in email.

## Application overview
This demo is written in Javascript (Node.js) with the [Express framework](https://expressjs.com/). You'll need to retrieve a set of testmode API keys from the Stripe dashboard (you can create a free test account [here](https://dashboard.stripe.com/register)) to run this locally.

We're using the [Bootstrap](https://getbootstrap.com/docs/4.6/getting-started/introduction/) CSS framework. It's the most popular CSS framework in the world and is pretty easy to get started with — feel free to modify styles/layout if you like. 

To simplify this project, we're also not using any database here, either. Instead `app.js` includes a simple switch statement to read the GET params for `item`. 

To get started, clone the repository and run `npm install` to install dependencies:

```
git clone https://github.com/mattmitchell6/sa-takehome-project-node && cd sa-takehome-project-node
npm install
```

Rename `sample.env` to `.env` and populate with your Stripe account's test API keys

Then run the application locally:

```
npm start
```

Navigate to [http://localhost:3000](http://localhost:3000) to view the index page.




