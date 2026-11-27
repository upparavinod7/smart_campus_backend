const express = require("express");
const authenticateToken = require("../middleware/auth.middleware");
const authorizeRoles = require("../middleware/role.middleware");
const creditsController = require("../controllers/credits.controller");

const router = express.Router();

router.use(authenticateToken);

router.get(
  "/wallet",
  authorizeRoles("FACULTY"),
  creditsController.getWallet,
);
router.post(
  "/requests",
  authorizeRoles("FACULTY"),
  creditsController.createCreditRequest,
);
router.post(
  "/payments/orders",
  authorizeRoles("FACULTY"),
  creditsController.createCreditPaymentOrder,
);
router.post(
  "/payments/verify",
  authorizeRoles("FACULTY"),
  creditsController.verifyCreditPayment,
);
router.post(
  "/notifications/acknowledge",
  authorizeRoles("FACULTY"),
  creditsController.acknowledgeCredits,
);
router.get(
  "/admin/overview",
  authorizeRoles("ADMIN"),
  creditsController.getAdminOverview,
);
router.put(
  "/admin/settings",
  authorizeRoles("ADMIN"),
  creditsController.updateSettings,
);
router.post(
  "/admin/payments/orders",
  authorizeRoles("ADMIN"),
  creditsController.createCreditPoolPaymentOrder,
);
router.post(
  "/admin/payments/verify",
  authorizeRoles("ADMIN"),
  creditsController.verifyCreditPoolPayment,
);
router.post(
  "/admin/wallets/:facultyId/grant",
  authorizeRoles("ADMIN"),
  creditsController.grantCredits,
);
router.put(
  "/admin/requests/:requestId",
  authorizeRoles("ADMIN"),
  creditsController.decideCreditRequest,
);

module.exports = router;
