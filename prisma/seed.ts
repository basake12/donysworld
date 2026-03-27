import {
  PrismaClient,
  Role,
  Gender,
  BodyType,
  Complexion,
  MeetType,
  OfferStatus,
  ModelStatus,
  DocumentType,
  TransactionType,
  TransactionStatus,
} from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding Dony's World...\n");

  // ─────────────────────────────────────────
  // ADMIN
  // ─────────────────────────────────────────

  const adminPassword = await bcrypt.hash("Admin@Dony2024!", 12);

  const admin = await prisma.user.upsert({
    where: { email: "admin@donysworld.com" },
    update: {},
    create: {
      fullName: "Dony Admin",
      email: "admin@donysworld.com",
      password: adminPassword,
      role: Role.ADMIN,
      gender: Gender.MALE,
      whatsappNumber: "+2348000000000",
      adminProfile: { create: {} },
      wallet: { create: { balance: 0, pendingCoins: 0 } },
    },
  });

  console.log("✅ Admin created:", admin.email);

  // ─────────────────────────────────────────
  // PLATFORM BANK ACCOUNT
  // ─────────────────────────────────────────

  await prisma.bankAccount.upsert({
    where: { id: "platform-bank-001" },
    update: {},
    create: {
      id: "platform-bank-001",
      bankName: "First Bank of Nigeria",
      accountNumber: "3012345678",
      accountName: "Dony's World Ltd",
      isActive: true,
    },
  });

  console.log("✅ Platform bank account created");

  // ─────────────────────────────────────────
  // CLIENTS (3)
  // ─────────────────────────────────────────

  const clientPassword = await bcrypt.hash("Client@123!", 12);

  const clientsData = [
    {
      fullName: "Emeka Johnson",
      email: "emeka@test.com",
      gender: Gender.MALE,
      genderInterestedIn: Gender.FEMALE,
      whatsappNumber: "+2348011111111",
      balance: 500000,
    },
    {
      fullName: "Ngozi Adeyemi",
      email: "ngozi@test.com",
      gender: Gender.FEMALE,
      genderInterestedIn: Gender.MALE,
      whatsappNumber: "+2348022222222",
      balance: 300000,
    },
    {
      fullName: "Chukwudi Okafor",
      email: "chukwudi@test.com",
      gender: Gender.MALE,
      genderInterestedIn: Gender.FEMALE,
      whatsappNumber: "+2348033333333",
      balance: 750000,
    },
  ];

  const clients = [];

  for (const data of clientsData) {
    const { genderInterestedIn, balance, ...userData } = data;
    const client = await prisma.user.upsert({
      where: { email: data.email },
      update: {},
      create: {
        ...userData,
        password: clientPassword,
        role: Role.CLIENT,
        clientProfile: {
          create: { genderInterestedIn },
        },
        wallet: { create: { balance, pendingCoins: 0 } },
      },
      include: { wallet: true, clientProfile: true },
    });

    // Fund wallet transaction
    if (client.wallet) {
      await prisma.transaction.upsert({
        where: { reference: `seed-fund-${client.id}` },
        update: {},
        create: {
          walletId: client.wallet.id,
          type: TransactionType.FUND_WALLET,
          status: TransactionStatus.COMPLETED,
          amount: balance,
          description: `Initial wallet funding — ₦${(balance * 10).toLocaleString()}`,
          reference: `seed-fund-${client.id}`,
        },
      });
    }

    clients.push(client);
    console.log(`✅ Client created: ${client.email} | Balance: ${balance.toLocaleString()} DC`);
  }

  // ─────────────────────────────────────────
  // MODELS (3)
  // ─────────────────────────────────────────

  const modelPassword = await bcrypt.hash("Model@123!", 12);

  const modelsData = [
    {
      fullName: "Amaka Eze",
      nickname: "Queen Zara",
      email: "amaka@test.com",
      gender: Gender.FEMALE,
      whatsappNumber: "+2348044444444",
      age: 24,
      height: "5'6\"",
      city: "Lekki",
      state: "Lagos",
      bodyType: BodyType.CURVY,
      complexion: Complexion.DARK,
      about:
        "Fun, vibrant and easy to talk to. I love good conversations and new experiences. Let's make memories.",
      allowFaceReveal: true,
      profilePictureUrl:
        "https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=400",
      charges: {
        SHORT: { min: 35000, max: 50000 },
        OVERNIGHT: { min: 70000, max: 100000 },
        WEEKEND: { min: 180000, max: 250000 },
      },
      bankAccount: {
        bankName: "Guaranty Trust Bank",
        accountNumber: "0112345678",
      },
    },
    {
      fullName: "Fatima Abdullahi",
      nickname: "Princess Fati",
      email: "fatima@test.com",
      gender: Gender.FEMALE,
      whatsappNumber: "+2348055555555",
      age: 26,
      height: "5'4\"",
      city: "Wuse",
      state: "FCT",
      bodyType: BodyType.SLIM,
      complexion: Complexion.FAIR,
      about:
        "Calm, classy and sophisticated. I enjoy fine dining, travelling and meaningful connections.",
      allowFaceReveal: true,
      profilePictureUrl:
        "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400",
      charges: {
        SHORT: { min: 40000, max: 50000 },
        OVERNIGHT: { min: 80000, max: 100000 },
        WEEKEND: { min: 200000, max: 280000 },
      },
      bankAccount: {
        bankName: "Access Bank",
        accountNumber: "0223456789",
      },
    },
    {
      fullName: "Blessing Obi",
      nickname: "Exotic Blessie",
      email: "blessing@test.com",
      gender: Gender.FEMALE,
      whatsappNumber: "+2348066666666",
      age: 22,
      height: "5'8\"",
      city: "Port Harcourt",
      state: "Rivers",
      bodyType: BodyType.ATHLETIC,
      complexion: Complexion.MEDIUM,
      about:
        "Adventurous and spontaneous. I bring energy and excitement to every meeting. Let's have fun!",
      allowFaceReveal: false,
      profilePictureUrl:
        "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=400",
      charges: {
        SHORT: { min: 30000, max: 45000 },
        OVERNIGHT: { min: 65000, max: 90000 },
        WEEKEND: { min: 160000, max: 220000 },
      },
      bankAccount: {
        bankName: "Zenith Bank",
        accountNumber: "2034567890",
      },
    },
  ];

  const models = [];

  for (const data of modelsData) {
    const { charges, bankAccount, nickname, ...userData } = data;

    const model = await prisma.user.upsert({
      where: { email: data.email },
      update: {},
      create: {
        fullName: userData.fullName,
        nickname,
        email: userData.email,
        password: modelPassword,
        role: Role.MODEL,
        gender: userData.gender,
        whatsappNumber: userData.whatsappNumber,
        wallet: { create: { balance: 50000, pendingCoins: 0 } },
      },
      include: { wallet: true },
    });

    // Upsert model profile
    const profile = await prisma.modelProfile.upsert({
      where: { userId: model.id },
      update: {},
      create: {
        userId: model.id,
        status: ModelStatus.ACTIVE,
        age: userData.age,
        height: userData.height,
        city: userData.city,
        state: userData.state,
        bodyType: userData.bodyType,
        complexion: userData.complexion,
        about: userData.about,
        allowFaceReveal: userData.allowFaceReveal,
        profilePictureUrl: userData.profilePictureUrl,
        isFaceBlurred: true,
      },
    });

    // Add mock legal document
    await prisma.modelDocument.upsert({
      where: { id: `doc-${model.id}` },
      update: {},
      create: {
        id: `doc-${model.id}`,
        modelProfileId: profile.id,
        documentType: DocumentType.NIN,
        documentUrl: `seed/documents/${model.id}_nin.jpg`,
      },
    });

    // Set charges
    for (const [type, vals] of Object.entries(charges)) {
      await prisma.modelCharge.upsert({
        where: {
          modelProfileId_meetType: {
            modelProfileId: profile.id,
            meetType: type as MeetType,
          },
        },
        update: {},
        create: {
          modelProfileId: profile.id,
          meetType: type as MeetType,
          minCoins: vals.min,
          maxCoins: vals.max,
        },
      });
    }

    // Add bank account
    const existingBank = await prisma.modelBankAccount.findFirst({
      where: { modelUserId: model.id },
    });

    if (!existingBank) {
      await prisma.modelBankAccount.create({
        data: {
          modelUserId: model.id,
          bankName: bankAccount.bankName,
          accountNumber: bankAccount.accountNumber,
          accountName: userData.fullName,
          isPreferred: true,
          isLocked: true,
        },
      });
    }

    // Wallet transaction for seed balance
    if (model.wallet) {
      await prisma.transaction.upsert({
        where: { reference: `seed-earn-${model.id}` },
        update: {},
        create: {
          walletId: model.wallet.id,
          type: TransactionType.OFFER_CREDIT,
          status: TransactionStatus.COMPLETED,
          amount: 50000,
          description: "Initial seed earnings",
          reference: `seed-earn-${model.id}`,
        },
      });
    }

    models.push({ ...model, profile });
    console.log(`✅ Model created: ${model.email} | Nickname: ${nickname} | State: ${userData.state}`);
  }

  // ─────────────────────────────────────────
  // SAMPLE OFFERS (3 — one per status type)
  // ─────────────────────────────────────────

  const client1 = clients[0];
  const client2 = clients[1];
  const client3 = clients[2];
  const model1 = models[0];
  const model2 = models[1];
  const model3 = models[2];

  // Offer 1 — PENDING
  const offer1 = await prisma.offer.upsert({
    where: { id: "seed-offer-001" },
    update: {},
    create: {
      id: "seed-offer-001",
      clientId: client1.id,
      modelId: model1.id,
      meetType: MeetType.SHORT,
      coinsAmount: 45000,
      status: OfferStatus.PENDING,
    },
  });

  // Debit client for pending offer
  if (client1.wallet) {
    await prisma.wallet.update({
      where: { id: client1.wallet.id },
      data: { balance: { decrement: 49500 } }, // 45000 + 10% fee
    });

    await prisma.transaction.upsert({
      where: { reference: `seed-offer-debit-001` },
      update: {},
      create: {
        walletId: client1.wallet.id,
        type: TransactionType.OFFER_DEBIT,
        status: TransactionStatus.COMPLETED,
        amount: 49500,
        description: `Offer to ${model1.nickname} — SHORT meet`,
        reference: "seed-offer-debit-001",
      },
    });
  }

  console.log("✅ Offer 1 created: PENDING");

  // Offer 2 — ACCEPTED with receipt
  const offer2 = await prisma.offer.upsert({
    where: { id: "seed-offer-002" },
    update: {},
    create: {
      id: "seed-offer-002",
      clientId: client2.id,
      modelId: model2.id,
      meetType: MeetType.OVERNIGHT,
      coinsAmount: 90000,
      status: OfferStatus.ACCEPTED,
      token: "seed-token-abc123def456ghi789",
    },
  });

  await prisma.receipt.upsert({
    where: { offerId: "seed-offer-002" },
    update: {},
    create: {
      offerId: "seed-offer-002",
      couponCode: "SEED-ABCD-1234",
      modelWhatsapp: model2.whatsappNumber,
      coinsAmount: 90000,
      isRedeemed: false,
    },
  });

  console.log("✅ Offer 2 created: ACCEPTED | Coupon: SEED-ABCD-1234");

  // Offer 3 — COMPLETED
  const offer3 = await prisma.offer.upsert({
    where: { id: "seed-offer-003" },
    update: {},
    create: {
      id: "seed-offer-003",
      clientId: client3.id,
      modelId: model3.id,
      meetType: MeetType.WEEKEND,
      coinsAmount: 200000,
      status: OfferStatus.COMPLETED,
      token: "seed-token-xyz789uvw456rst123",
    },
  });

  await prisma.receipt.upsert({
    where: { offerId: "seed-offer-003" },
    update: {},
    create: {
      offerId: "seed-offer-003",
      couponCode: "DONE-WXYZ-5678",
      modelWhatsapp: model3.whatsappNumber,
      coinsAmount: 200000,
      isRedeemed: true,
      redeemedAt: new Date(),
    },
  });

  console.log("✅ Offer 3 created: COMPLETED | Coupon redeemed");

  // ─────────────────────────────────────────
  // ADMIN WALLET — seed revenue
  // ─────────────────────────────────────────

  const adminWallet = await prisma.wallet.findUnique({
    where: { userId: admin.id },
  });

  if (adminWallet) {
    await prisma.wallet.update({
      where: { id: adminWallet.id },
      data: { balance: 45000 },
    });

    await prisma.transaction.upsert({
      where: { reference: "seed-admin-revenue" },
      update: {},
      create: {
        walletId: adminWallet.id,
        type: TransactionType.CONNECTION_FEE,
        status: TransactionStatus.COMPLETED,
        amount: 45000,
        description: "Seed connection fees from sample offers",
        reference: "seed-admin-revenue",
      },
    });
  }

  // ─────────────────────────────────────────
  // NOTIFICATIONS
  // ─────────────────────────────────────────

  await prisma.notification.createMany({
    skipDuplicates: true,
    data: [
      {
        userId: model1.id,
        title: "New Offer Received",
        message: `You have a new SHORT meet offer of 45,000 DC. Tap to review.`,
        link: "/model/offers",
        isRead: false,
      },
      {
        userId: client2.id,
        title: "Offer Accepted! 🎉",
        message: `${model2.nickname} accepted your offer. Check your receipt for the coupon code.`,
        link: "/client/offers",
        isRead: false,
      },
      {
        userId: admin.id,
        title: "Platform Active",
        message: "Database seeded successfully. Platform is ready for testing.",
        link: "/admin/dashboard",
        isRead: false,
      },
    ],
  });

  console.log("✅ Notifications seeded\n");

  // ─────────────────────────────────────────
  // SUMMARY
  // ─────────────────────────────────────────

  console.log("─────────────────────────────────────────");
  console.log("🎉 Seed complete!\n");
  console.log("ADMIN LOGIN");
  console.log("  Email:    admin@donysworld.com");
  console.log("  Password: Admin@Dony2024!\n");
  console.log("CLIENT LOGINS (password: Client@123!)");
  console.log("  emeka@test.com    | Balance: 450,500 DC");
  console.log("  ngozi@test.com    | Balance: 300,000 DC");
  console.log("  chukwudi@test.com | Balance: 750,000 DC\n");
  console.log("MODEL LOGINS (password: Model@123!)");
  console.log("  amaka@test.com    | Queen Zara     | Lagos, Lekki");
  console.log("  fatima@test.com   | Princess Fati  | FCT, Wuse");
  console.log("  blessing@test.com | Exotic Blessie | Rivers, PH\n");
  console.log("SAMPLE OFFERS");
  console.log("  Offer 1: PENDING   — Emeka → Queen Zara     | SHORT  | 45,000 DC");
  console.log("  Offer 2: ACCEPTED  — Ngozi → Princess Fati  | OVERNIGHT | 90,000 DC | Coupon: SEED-ABCD-1234");
  console.log("  Offer 3: COMPLETED — Chukwudi → Exotic Blessie | WEEKEND | 200,000 DC");
  console.log("─────────────────────────────────────────");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());