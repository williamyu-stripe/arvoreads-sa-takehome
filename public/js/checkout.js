/**
 * Checkout page: mounts the Stripe Payment Element and confirms the payment
 */

(function() {
  var form = document.getElementById('payment-form');
  var submitButton = document.getElementById('submit');
  var message = document.getElementById('payment-message');

  // The server renders the publishable key and the PaymentIntent's client_secret onto the form
  var stripe = Stripe(form.dataset.publishableKey);
  var elements = stripe.elements({ clientSecret: form.dataset.clientSecret });

  // One email field for both the app and Link. Without it, Link shows its own
  // email field inside the Payment Element, so the page had two.
  var email = '';
  var contactDetailsElement = elements.create('contactDetails');
  contactDetailsElement.mount('#contact-details-element');
  contactDetailsElement.on('change', function(event) {
    email = (event.value && event.value.email) || '';
  });

  var paymentElement = elements.create('payment');
  paymentElement.mount('#payment-element');

  form.addEventListener('submit', async function(event) {
    event.preventDefault();
    submitButton.disabled = true;
    message.textContent = '';

    // Validate the Payment Element first. Stripe asks for this before any other async
    // work (like the email fetch below) so wallets such as Apple Pay still open correctly.
    var submitResult = await elements.submit();
    if (submitResult.error) {
      message.textContent = submitResult.error.message;
      submitButton.disabled = false;
      return;
    }

    var confirmParams = {
      // Stripe redirects here after the payment, adding ?payment_intent=pi_... to the URL
      return_url: window.location.origin + '/success'
    };

    if (email) {
      confirmParams.receipt_email = email;

      // Save the email as PaymentIntent metadata (server-side) before confirming.
      // Any failure (network error, missing route, non-JSON reply) shows a message
      // instead of leaving the Pay button stuck.
      try {
        var response = await fetch('/payment-intent/email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ clientSecret: form.dataset.clientSecret, email: email })
        });

        if (!response.ok) {
          var body = await response.json().catch(function() { return {}; });
          throw new Error(body.error || "We couldn't save your email. Please try again.");
        }
      } catch (err) {
        message.textContent = err.message;
        submitButton.disabled = false;
        return;
      }
    }

    // Only reached if the payment fails (e.g. declined card); on success Stripe redirects
    var result = await stripe.confirmPayment({
      elements: elements,
      confirmParams: confirmParams
    });

    message.textContent = result.error.message;
    submitButton.disabled = false;
  });
})();
