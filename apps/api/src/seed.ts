import { prisma } from './db.js';

export async function seedDatabase() {
  const existingClients = await prisma.customer.count();
  if (existingClients === 0) {
    await prisma.customer.createMany({
      data: [
        {
          fullName: 'ABUBAKAR IBRAHIM ZAKARIA',
          customerType: 'INDIVIDUAL',
          idType: 'NIDA',
          idNumber: '19900304141120000120',
          tinNumber: '114-998-273',
          phone: '+255716693809',
          email: 'abubakar@kib.co.tz',
          dateOfBirth: '1990-03-04',
          gender: 'Male',
          nationality: 'Tanzania',
          region: 'Dar Es Salaam',
          district: 'Kinondoni',
          address: 'P.O. Box 75887, Dar es Salaam',
        },
        {
          fullName: 'JEREMIAH FOWAHEDI NTAKANDI',
          customerType: 'INDIVIDUAL',
          idType: 'NIDA',
          idNumber: '20030101010134000043',
          tinNumber: '123-123-123',
          phone: '+255765849609',
          email: 'ntakandi.jeremiah@kanga.co.tz',
          dateOfBirth: '2003-01-01',
          gender: 'Male',
          nationality: 'Tanzania',
          region: 'Dar Es Salaam',
          district: 'Ubungo',
          address: 'P.O. Box Dar es Salaam, Kimara',
        },
        {
          fullName: 'AMINA HASSAN MWANGI',
          customerType: 'INDIVIDUAL',
          idType: 'NIDA',
          idNumber: '19920518141020000511',
          phone: '+255754221908',
          email: 'amina.mwangi@gmail.com',
          dateOfBirth: '1992-05-18',
          gender: 'Female',
          nationality: 'Tanzania',
          region: 'Dar Es Salaam',
          district: 'Ilala',
          address: 'Upanga West, Dar es Salaam',
        },
        {
          fullName: 'ASAMOIL COMPANY LIMITED',
          customerType: 'CORPORATE',
          idType: 'TIN',
          idNumber: '108-442-991',
          tinNumber: '108-442-991',
          phone: '+255222127217',
          email: 'fleet@asamoil.co.tz',
          nationality: 'Tanzania',
          region: 'Dar Es Salaam',
          district: 'Temeke',
          address: 'Kurasini Industrial Area, Dar es Salaam',
        },
        {
          fullName: 'DAR EXPRESS COMMUTERS LTD',
          customerType: 'CORPORATE',
          idType: 'TIN',
          idNumber: '119-884-210',
          tinNumber: '119-884-210',
          phone: '+255713554090',
          email: 'ops@darexpress.co.tz',
          nationality: 'Tanzania',
          region: 'Dar Es Salaam',
          district: 'Ubungo',
          address: 'Ubungo Terminal Plaza, Dar es Salaam',
        },
      ],
    });
    console.log('Seeded 5 initial clients.');
  }

  // Seed UAT Settings (configurable via environment variables)
  const existingSettings = await prisma.uatSettings.findUnique({ where: { id: 'singleton' } });
  if (!existingSettings) {
    await prisma.uatSettings.create({
      data: {
        id: 'singleton',
        testingOpen: true,
        brokerAccessCode: process.env.UAT_BROKER_CODE || 'COVERFLOW-UAT',
        adminPasscode: process.env.UAT_ADMIN_PASSCODE || 'ADMIN-2026',
      },
    });
  }

  // Seed initial Admin + Sample Broker Tester Gmail
  const existingTesters = await prisma.allowedTester.count();
  if (existingTesters === 0) {
    const adminEmail = (process.env.UAT_ADMIN_EMAIL || 'admin@coverflow.co.tz').toLowerCase();
    await prisma.allowedTester.createMany({
      data: [
        {
          email: adminEmail,
          name: 'CoverFlow Product Admin',
          organization: 'CoverFlow Team',
          role: 'ADMIN',
          active: true,
        },
        {
          email: 'broker.test@gmail.com',
          name: 'Sample Broker Tester',
          organization: 'Kangaroo Insurance Brokers',
          role: 'BROKER_TESTER',
          active: true,
        },
      ],
    });
    console.log(`Seeded UAT allowlist (Admin: ${adminEmail}, Sample Broker: broker.test@gmail.com).`);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  seedDatabase()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
