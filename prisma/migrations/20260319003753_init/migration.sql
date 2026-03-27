-- CreateEnum
CREATE TYPE "Role" AS ENUM ('CLIENT', 'MODEL', 'ADMIN');

-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE', 'OTHER');

-- CreateEnum
CREATE TYPE "BodyType" AS ENUM ('SLIM', 'AVERAGE', 'ATHLETIC', 'CURVY', 'PLUS_SIZE');

-- CreateEnum
CREATE TYPE "Complexion" AS ENUM ('FAIR', 'LIGHT', 'MEDIUM', 'OLIVE', 'TAN', 'DARK');

-- CreateEnum
CREATE TYPE "MeetType" AS ENUM ('SHORT', 'OVERNIGHT', 'WEEKEND');

-- CreateEnum
CREATE TYPE "OfferStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('FUND_WALLET', 'OFFER_DEBIT', 'OFFER_CREDIT', 'FACE_REVEAL_DEBIT', 'FACE_REVEAL_CREDIT', 'CONNECTION_FEE', 'REDEMPTION', 'WITHDRAWAL');

-- CreateEnum
CREATE TYPE "TransactionStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "ModelStatus" AS ENUM ('PENDING_APPROVAL', 'ACTIVE', 'SUSPENDED', 'REJECTED');

-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('NIN', 'DRIVERS_LICENSE', 'VOTERS_CARD', 'INTERNATIONAL_PASSPORT');

-- CreateEnum
CREATE TYPE "FundingRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "WithdrawalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "nickname" TEXT,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "gender" "Gender" NOT NULL,
    "whatsappNumber" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "client_profiles" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "genderInterestedIn" "Gender" NOT NULL,

    CONSTRAINT "client_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "model_profiles" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "ModelStatus" NOT NULL DEFAULT 'PENDING_APPROVAL',
    "age" INTEGER NOT NULL,
    "height" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "bodyType" "BodyType" NOT NULL,
    "complexion" "Complexion" NOT NULL,
    "about" TEXT NOT NULL,
    "allowFaceReveal" BOOLEAN NOT NULL DEFAULT false,
    "profilePictureUrl" TEXT NOT NULL,
    "isFaceBlurred" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "model_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "model_documents" (
    "id" TEXT NOT NULL,
    "modelProfileId" TEXT NOT NULL,
    "documentType" "DocumentType" NOT NULL,
    "documentUrl" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "model_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "model_charges" (
    "id" TEXT NOT NULL,
    "modelProfileId" TEXT NOT NULL,
    "meetType" "MeetType" NOT NULL,
    "minCoins" INTEGER NOT NULL,
    "maxCoins" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "model_charges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "model_bank_accounts" (
    "id" TEXT NOT NULL,
    "modelUserId" TEXT NOT NULL,
    "bankName" TEXT NOT NULL,
    "accountNumber" TEXT NOT NULL,
    "accountName" TEXT NOT NULL,
    "isPreferred" BOOLEAN NOT NULL DEFAULT false,
    "isLocked" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "model_bank_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "withdrawal_requests" (
    "id" TEXT NOT NULL,
    "modelUserId" TEXT NOT NULL,
    "bankAccountId" TEXT NOT NULL,
    "coinsAmount" INTEGER NOT NULL,
    "nairaAmount" INTEGER NOT NULL,
    "status" "WithdrawalStatus" NOT NULL DEFAULT 'PENDING',
    "adminNote" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "withdrawal_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_profiles" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "admin_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wallets" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "balance" INTEGER NOT NULL DEFAULT 0,
    "pendingCoins" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wallets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transactions" (
    "id" TEXT NOT NULL,
    "walletId" TEXT NOT NULL,
    "type" "TransactionType" NOT NULL,
    "status" "TransactionStatus" NOT NULL DEFAULT 'PENDING',
    "amount" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "reference" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "offers" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "modelId" TEXT NOT NULL,
    "meetType" "MeetType" NOT NULL,
    "coinsAmount" INTEGER NOT NULL,
    "status" "OfferStatus" NOT NULL DEFAULT 'PENDING',
    "token" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "offers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "receipts" (
    "id" TEXT NOT NULL,
    "offerId" TEXT NOT NULL,
    "couponCode" TEXT NOT NULL,
    "modelWhatsapp" TEXT NOT NULL,
    "coinsAmount" INTEGER NOT NULL,
    "isRedeemed" BOOLEAN NOT NULL DEFAULT false,
    "redeemedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "receipts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "face_reveals" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "modelProfileId" TEXT NOT NULL,
    "coinsCharged" INTEGER NOT NULL DEFAULT 1000,
    "modelEarning" INTEGER NOT NULL DEFAULT 500,
    "adminEarning" INTEGER NOT NULL DEFAULT 500,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "face_reveals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "link" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bank_accounts" (
    "id" TEXT NOT NULL,
    "bankName" TEXT NOT NULL,
    "accountNumber" TEXT NOT NULL,
    "accountName" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bank_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "funding_requests" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "nairaAmount" INTEGER NOT NULL,
    "coinsAmount" INTEGER NOT NULL,
    "proofImageUrl" TEXT NOT NULL,
    "status" "FundingRequestStatus" NOT NULL DEFAULT 'PENDING',
    "adminNote" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "funding_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_sessionToken_key" ON "sessions"("sessionToken");

-- CreateIndex
CREATE UNIQUE INDEX "client_profiles_userId_key" ON "client_profiles"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "model_profiles_userId_key" ON "model_profiles"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "model_charges_modelProfileId_meetType_key" ON "model_charges"("modelProfileId", "meetType");

-- CreateIndex
CREATE UNIQUE INDEX "admin_profiles_userId_key" ON "admin_profiles"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "wallets_userId_key" ON "wallets"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "transactions_reference_key" ON "transactions"("reference");

-- CreateIndex
CREATE UNIQUE INDEX "offers_token_key" ON "offers"("token");

-- CreateIndex
CREATE UNIQUE INDEX "receipts_offerId_key" ON "receipts"("offerId");

-- CreateIndex
CREATE UNIQUE INDEX "receipts_couponCode_key" ON "receipts"("couponCode");

-- CreateIndex
CREATE UNIQUE INDEX "face_reveals_clientId_modelProfileId_key" ON "face_reveals"("clientId", "modelProfileId");

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_profiles" ADD CONSTRAINT "client_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "model_profiles" ADD CONSTRAINT "model_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "model_documents" ADD CONSTRAINT "model_documents_modelProfileId_fkey" FOREIGN KEY ("modelProfileId") REFERENCES "model_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "model_charges" ADD CONSTRAINT "model_charges_modelProfileId_fkey" FOREIGN KEY ("modelProfileId") REFERENCES "model_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "model_bank_accounts" ADD CONSTRAINT "model_bank_accounts_modelUserId_fkey" FOREIGN KEY ("modelUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "withdrawal_requests" ADD CONSTRAINT "withdrawal_requests_modelUserId_fkey" FOREIGN KEY ("modelUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "withdrawal_requests" ADD CONSTRAINT "withdrawal_requests_bankAccountId_fkey" FOREIGN KEY ("bankAccountId") REFERENCES "model_bank_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin_profiles" ADD CONSTRAINT "admin_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wallets" ADD CONSTRAINT "wallets_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "wallets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offers" ADD CONSTRAINT "offers_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offers" ADD CONSTRAINT "offers_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "offers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "face_reveals" ADD CONSTRAINT "face_reveals_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "client_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "face_reveals" ADD CONSTRAINT "face_reveals_modelProfileId_fkey" FOREIGN KEY ("modelProfileId") REFERENCES "model_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "funding_requests" ADD CONSTRAINT "funding_requests_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
