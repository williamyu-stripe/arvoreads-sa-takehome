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

    var email = document.getElementById('email').value.trim();
    if (email) {
      confirmParams.receipt_email = email;

      // Save the email as PaymentIntent metadata (server-side) before confirming
      var response = await fetch('/payment-intent/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientSecret: form.dataset.clientSecret, email: email })
      });

      if (!response.ok) {
        var body = await response.json();
        message.textContent = body.error;
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
