import transactionController from "../controllers/PhonepeController.js";
import express from 'express';
const router = express.Router();

// Test route to verify PhonePe routes are working
router.get("/test", (req, res) => {
  res.json({ message: "PhonePe routes are working correctly!", timestamp: new Date().toISOString() });
});

router.post("/addpaymentphonepay", transactionController.addPaymentPhone);
// router.post("/addpaymentmobile",transactionController.addPaymentMobile);
router.post("/makepayment", transactionController.makepayment);
router.put("/updateStatuspayment/:id", transactionController.updateStatuspayment);
router.get("/getallpayment", transactionController.getallpayment);
router.post("/payment-callback", transactionController.paymentcallback);
router.get("/checkPayment/:id/:userId", transactionController.checkPayment);
export default router; 