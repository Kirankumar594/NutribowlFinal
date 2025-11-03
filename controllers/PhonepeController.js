import axios from "axios";
import crypto from 'crypto';

const MERCHANT_ID = "M23XA8YTUO61B";
const SECRET_KEY = "3079f6a3-6f25-4c47-bd4e-c581051ad263";  
const PHONEPE_API_URL = "https://api.phonepe.com/apis/hermes/pg/v1/pay"; 
const CALLBACK_URL = "https://nutribowl.org";  

import transactionModel from "../models/PhonepeModel.js";
import Checkout from "../models/CheckoutModel.js";

import {
  StandardCheckoutClient,
  Env,
  StandardCheckoutPayRequest,
  MetaInfo,
  CreateSdkOrderRequest
} from "pg-sdk-node";

// const clientId = "M22IJ7E10A8LQ";
const clientId = "SU2510151651095669332240";
const clientSecret = "3079f6a3-6f25-4c47-bd4e-c581051ad263";
const clientVersion = 1;
const env = Env.PRODUCTION;
// const env = Env.SANDBOX;
// const CALLBACK_URL = "https://sbwears.com/update/paymentstatus/:id";

let client;
try {
  client = StandardCheckoutClient.getInstance(
    clientId,
    clientSecret,
    clientVersion,
    env
  );
  console.log("PhonePe SDK client initialized successfully");
} catch (error) {
  console.error("Failed to initialize PhonePe SDK client:", error);
  client = null;
}

class Transaction {

  async addPaymentPhone(req, res) {

    try {
      const { userId, username, Mobile, orderId, amount, config, successUrl, failedUrl } = req.body;

      // Validate required fields
      if (!userId || !username || !Mobile || !amount) {
        return res.status(400).json({ 
          error: "Missing required fields",
          details: "userId, username, Mobile, and amount are required"
        });
      }

      console.log("Creating transaction for user:", userId, "amount:", amount);

      // Save transaction details in DB
      const data = await transactionModel.create({
        userId,
        username,
        Mobile,
        orderId,
        amount,
        config,
        successUrl,
        failedUrl
      });

      if (!data) {
        console.error("Failed to create transaction record");
        return res.status(400).json({ error: "Failed to create transaction record" });
      }

      console.log("Transaction created with ID:", data._id);

      const merchantOrderId = data._id.toString(); // Use DB _id as unique order ID

      const redirectUrl = `https://nutribowl.org/payment-success?transactionId=${data._id}&userID=${userId}`;

      console.log("Building payment request for merchantOrderId:", merchantOrderId);

      // Check if PhonePe client is initialized
      if (!client) {
        console.error("PhonePe SDK client not initialized");
        return res.status(500).json({ 
          error: "Payment service unavailable",
          details: "PhonePe SDK client initialization failed"
        });
      }

      // Build the payment request
      const paymentRequest = CreateSdkOrderRequest.StandardCheckoutBuilder()
        .merchantOrderId(merchantOrderId)
        .amount(amount * 100) // Convert to paise
        .redirectUrl(redirectUrl)
        .build();

      console.log("Sending payment request to PhonePe...");

      try {
        // Try SDK approach first
        const response = await client.pay(paymentRequest);
        console.log("PhonePe SDK response:", response);
        
        const checkoutUrl = response.redirectUrl;

        if (checkoutUrl) {
          console.log("Payment URL generated successfully via SDK:", checkoutUrl);
          return res.status(200).json({
            orderId: response.orderId,
            merchantID: merchantOrderId,
            url: checkoutUrl,
          });
        }
      } catch (sdkError) {
        console.error("PhonePe SDK failed, trying direct API approach:", sdkError.message);
      }

      // Fallback to direct API approach
      console.log("Using direct PhonePe API as fallback...");
      
      const paymentPayload = {
        merchantId: MERCHANT_ID,
        merchantTransactionId: merchantOrderId,
        merchantUserId: userId,
        amount: amount * 100, // Convert to paise
        redirectUrl: redirectUrl,
        redirectMode: "POST",
        callbackUrl: `https://nutribowl.org/api/user/checkPayment/${merchantOrderId}/${userId}`,
        mobileNumber: Mobile,
        paymentInstrument: {
          type: "PAY_PAGE",
        },
      };

      // Generate signature for direct API
      const payload = JSON.stringify(paymentPayload);
      const base64Payload = Buffer.from(payload).toString('base64');
      const stringToHash = base64Payload + '/pg/v1/pay' + SECRET_KEY;
      const sha256Hash = crypto.createHash('sha256').update(stringToHash).digest('hex');
      const signature = sha256Hash + '###' + 1;

      try {
        const directResponse = await axios.post(
          PHONEPE_API_URL,
          { request: base64Payload },
          {
            headers: {
              "X-VERIFY": signature,
              "Content-Type": "application/json"
            },
          }
        );

        console.log("PhonePe direct API response:", directResponse.data);
        
        const checkoutUrl = directResponse.data?.data?.instrumentResponse?.redirectInfo?.url;
        
        if (checkoutUrl) {
          console.log("Payment URL generated successfully via direct API:", checkoutUrl);
          return res.status(200).json({
            orderId: merchantOrderId,
            merchantID: merchantOrderId,
            url: checkoutUrl,
          });
        } else {
          console.error("Direct API also failed to return URL:", directResponse.data);
          return res.status(500).json({ 
            error: "PhonePe payment initialization failed",
            details: "Both SDK and direct API approaches failed"
          });
        }
      } catch (directApiError) {
        console.error("Direct API also failed:", directApiError.message);
        return res.status(500).json({ 
          error: "PhonePe payment initialization failed",
          details: directApiError.message
        });
      }
    } catch (error) {
      console.error("Payment Error:", error);
      console.error("Error stack:", error.stack);
      
      // Return more detailed error information
      return res.status(500).json({ 
        error: "Payment processing failed",
        details: error.message,
        type: error.constructor.name
      });
    }
  }

  async addPaymentMobile(req, res) {
    let transaction; // Declare transaction here to fix the ReferenceError

    try {
      // Validate input
      const { userId, username, Mobile, orderId, amount } = req.body;
      if (!userId || !username || !Mobile || !amount) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      // Create transaction record
      transaction = await transactionModel.create({
        userId,
        username,
        Mobile,
        orderId: orderId || `ORD_${Date.now()}`,
        amount,
        status: 'INITIATED'
      })

      // Prepare payment payload
      const paymentPayload = {
        merchantId: "M22IJ7E10A8LQ",
        merchantTransactionId: transaction._id.toString(),
        merchantUserId: userId,
        amount: amount * 100, // Convert to paise
        redirectUrl: `https://nutribowl.org/payment-success?transactionId=${transaction._id}&userID=${userId}`,


        callbackUrl: "https://nutribowl.org/api/user/checkPayment/" + transaction._id + "/" + userId,

        mobileNumber: Mobile,
        paymentInstrument: {
          type: "PAY_PAGE"
        }
      };

      // Generate signature
      const base64Payload = Buffer.from(JSON.stringify(paymentPayload)).toString('base64');
      const stringToHash = base64Payload + '/pg/v1/pay' + clientSecret;
      const sha256Hash = crypto.createHash('sha256').update(stringToHash).digest('hex')+'###' + 1;
      const signature = sha256Hash + '###' + clientSecret;

      res.status(200).json({
        success: true,
        data: {
          transactionBody: base64Payload,
          checksum: sha256Hash,
          transactionId: transaction._id,
        },
      });

    } catch (error) {
      console.error("Payment Error:", error.message);

      // Update transaction status if it was created
      if (transaction) {
        await transactionModel.findByIdAndUpdate(transaction._id, {
          status: 'FAILED',
          error: error.response?.data?.message || error.message
        });
      }

      return res.status(500).json({
        error: "Payment processing error",
        details: error.response?.data || error.message
      });
    }
  }

  async updateStatuspayment(req, res) {
    try {
      let id = req.params.id;
      let data = await transactionModel.findById(id);
      if (!data) return res.status(400).json({ error: "Data not found" });
      data.status = "Completed";
      data.save();
      return res.status(200).json({ success: "Successfully Completed" });
    } catch (error) {
      console.log(error);
    }
  }

  async checkPayment(req, res) {
    try {

      let id = req.params.id;
      let userId = req.params.userId
      let data = await transactionModel.findById(id);
      if (!data) return res.status(400).json({ error: "Payment Id not found!" })
      client.getOrderStatus(id).then(async (response) => {
        const state = response.state;
        if (state == "COMPLETED") {
          if (data.config) {
            await axios(JSON.parse(data.config))
            data.config = null
          }
          // If an order was created before payment, mark it Confirmed
          if (data.orderId && /^[0-9a-fA-F]{24}$/.test(data.orderId)) {
            try {
              await Checkout.findByIdAndUpdate(
                data.orderId,
                { status: 'Confirmed' },
                { new: true }
              );
            } catch (e) {
              console.error('Failed to update Checkout status to Confirmed:', e.message);
            }
          }
        }
        data.status = state;
        data = await data.save()
        return res.status(200).json({ success: data })
      }).catch((error) => {
        return res.status(400).json({ error: error })
      });

    } catch (error) {
      console.log(error)
      return res.status(400).json({ error: error.message })
    }
  }

  async paymentcallback(req, res) {
    const { response } = req.body;

    const decodedStr = Buffer.from(response, 'base64').toString('utf-8');

    // Parse JSON
    const responseJson = JSON.parse(decodedStr);
    console.log(responseJson?.data);
    const { merchantTransactionId, state } = responseJson?.data;

    // Log the callback data for debugging
    console.log(`Callback received: Transaction ${merchantTransactionId}, Status: ${state}`);
    let data = await transactionModel.findById(merchantTransactionId);
    if (data) {
      data.status = state;
      if (state === 'COMPLETED') {
        if (data.config) {
          await axios(JSON.parse(data.config))
        }
        // If an order was created before payment, mark it Confirmed
        if (data.orderId && /^[0-9a-fA-F]{24}$/.test(data.orderId)) {
          try {
            await Checkout.findByIdAndUpdate(
              data.orderId,
              { status: 'Confirmed' },
              { new: true }
            );
          } catch (e) {
            console.error('Failed to update Checkout status to Confirmed (callback):', e.message);
          }
        }
      }
      await data.save()
    }
    // Update transaction status in your database
    if (state === 'COMPLETED') {


      // Mark the transaction as successful
      // Update relevant database records
      console.log(`Transaction ${merchantTransactionId} was successful.`);
    } else {
      // Handle failure or pending status
      console.log(`Transaction ${merchantTransactionId} failed or is pending.`);
    }

    // Send a response back to the payment gateway
    res.status(200).send('Callback processed');
  }

  async getallpayment(req, res) {
    try {
      let data = await transactionModel.find({}).sort({ _id: -1 });
      return res.status(200).json({ success: data });
    } catch (error) {
      console.log(error)
    }
  }

  async makepayment(req, res) {
    let {
      amount,
      merchantTransactionId,
      merchantUserId,
      redirectUrl,
      callbackUrl,
      mobileNumber,
    } = req.body;

    function generateSignature(payload, saltKey, saltIndex) {
      const encodedPayload = Buffer.from(payload).toString("base64");
      const concatenatedString = encodedPayload + "/pg/v1/pay" + saltKey;
      const hashedValue = crypto
        .createHash("sha256")
        .update(concatenatedString)
        .digest("hex");

      const signature = hashedValue + "###" + saltIndex;
      return signature;
    }

    const paymentDetails = {
      merchantId: MERCHANT_ID,
      merchantTransactionId: merchantTransactionId,
      merchantUserId: merchantUserId,
      amount: amount,
      redirectUrl: CALLBACK_URL,
      redirectMode: "POST",
      callbackUrl: callbackUrl,
      mobileNumber: mobileNumber,
      paymentInstrument: {
        type: "PAY_PAGE",
      },
    };

    const payload = JSON.stringify(paymentDetails);
    let objJsonB64 = Buffer.from(payload).toString("base64");
    const saltKey = SECRET_KEY; //test key
    const saltIndex = 1;
    const signature = generateSignature(payload, saltKey, saltIndex);

    try {
      const response = await axios.post(
        "https://api.phonepe.com/apis/hermes/pg/v1/pay",

        // "https://api-preprod.phonepe.com/apis/pg-sandbox/pg/v1/pay",
        {
          request: objJsonB64,
        },
        {
          headers: {
            "X-VERIFY": signature,
          },
        }
      );

      //   console.log(
      //     "Payment Response:",
      //     response.data,
      //     response.data?.data.instrumentResponse?.redirectInfo?.url
      //   );
      return res.status(200).json({
        url: response.data?.data.instrumentResponse?.redirectInfo,
      });
    } catch (error) {
      console.error("Payment Error:", error);
    }
  }

}

export default new Transaction();

