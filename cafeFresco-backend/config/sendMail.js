const transporter = require('./mailer');

// Order confirmation from the stored order (never from client-supplied amounts)
const sendOrderMail = async (order, user) => {
    const mailOptions = {
        from: `"Cafe Fresco" <${process.env.EMAIL}>`,
        to: user.email,
        subject: 'Order Confirmation - Cafe Fresco',
        html: `
            <h2>Thanks for your order!</h2>
            <p><strong>Order ID:</strong> ${order._id}</p>
            <p><strong>Amount:</strong> $${Number(order.totalAmount).toFixed(2)}</p>
            <p><strong>Payment:</strong> ${order.paymentMethod === 'card' ? 'Card' : 'Cash on delivery'} (${order.paymentStatus})</p>
            <p>We’ll notify you when your order is shipped.</p>
        `
    };

    await transporter.sendMail(mailOptions);
};

module.exports = sendOrderMail;
