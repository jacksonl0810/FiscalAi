import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting seed...');

  // Create demo user
  const passwordHash = await bcrypt.hash('demo123', 12);
  
  const user = await prisma.user.upsert({
    where: { email: 'demo@fiscalai.com' },
    update: {},
    create: {
      email: 'demo@fiscalai.com',
      passwordHash,
      name: 'Usuário Demo'
    }
  });

  console.log('✅ User created:', user.email);

  // Create user settings
  await prisma.userSettings.upsert({
    where: { userId: user.id },
    update: {},
    create: {
      userId: user.id,
      theme: 'dark',
      fontSize: 'medium'
    }
  });

  console.log('✅ User settings created');

  // Create demo company
  const company = await prisma.company.upsert({
    where: { id: 'demo-company-id' },
    update: {},
    create: {
      id: 'demo-company-id',
      userId: user.id,
      cnpj: '12.345.678/0001-90',
      razaoSocial: 'Empresa Demo LTDA',
      nomeFantasia: 'Demo Company',
      cidade: 'São Paulo',
      uf: 'SP',
      cnaePrincipal: '6201-5/00',
      regimeTributario: 'MEI',
      certificadoDigital: false,
      email: 'contato@demo.com',
      telefone: '(11) 99999-9999',
      inscricaoMunicipal: '12345678'
    }
  });

  console.log('✅ Company created:', company.nomeFantasia);

  // Create fiscal integration status
  await prisma.fiscalIntegrationStatus.upsert({
    where: { companyId: company.id },
    update: {},
    create: {
      companyId: company.id,
      status: 'conectado',
      mensagem: 'Conexão estabelecida com sucesso',
      ultimaVerificacao: new Date()
    }
  });

  console.log('✅ Fiscal status created');

  // Update user settings with active company
  await prisma.userSettings.update({
    where: { userId: user.id },
    data: { activeCompanyId: company.id }
  });

  // Create some demo invoices
  const invoices = [
    {
      companyId: company.id,
      numero: 'NFS00000001',
      clienteNome: 'Maria Silva',
      clienteDocumento: '123.456.789-00',
      descricaoServico: 'Consultoria em marketing digital',
      valor: 2500.00,
      aliquotaIss: 5,
      valorIss: 125.00,
      status: 'autorizada',
      municipio: 'São Paulo',
      codigoVerificacao: 'ABC123XYZ',
      dataEmissao: new Date('2025-01-05'),
      dataPrestacao: new Date('2025-01-05')
    },
    {
      companyId: company.id,
      numero: 'NFS00000002',
      clienteNome: 'João Santos',
      clienteDocumento: '98.765.432/0001-10',
      descricaoServico: 'Desenvolvimento de website',
      valor: 5000.00,
      aliquotaIss: 5,
      valorIss: 250.00,
      status: 'autorizada',
      municipio: 'São Paulo',
      codigoVerificacao: 'DEF456UVW',
      dataEmissao: new Date('2025-01-10'),
      dataPrestacao: new Date('2025-01-10')
    },
    {
      companyId: company.id,
      clienteNome: 'Tech Solutions',
      clienteDocumento: '11.222.333/0001-44',
      descricaoServico: 'Suporte técnico mensal',
      valor: 1500.00,
      aliquotaIss: 5,
      valorIss: 75.00,
      status: 'pendente_confirmacao',
      municipio: 'São Paulo'
    }
  ];

  for (const invoiceData of invoices) {
    await prisma.invoice.create({ data: invoiceData });
  }

  console.log('✅ Demo invoices created');

  // Create demo DAS payments
  const dasPayments = [
    {
      companyId: company.id,
      referencia: '12/2024',
      dataVencimento: new Date('2025-01-20'),
      valorTotal: 71.00,
      valorInss: 66.00,
      valorIss: 5.00,
      status: 'pago',
      codigoBarras: '85890000000710012345678901234567890',
      dataPagamento: new Date('2025-01-15')
    },
    {
      companyId: company.id,
      referencia: '01/2025',
      dataVencimento: new Date('2025-02-20'),
      valorTotal: 71.00,
      valorInss: 66.00,
      valorIss: 5.00,
      status: 'pendente',
      codigoBarras: '85890000000710012345678901234567891'
    }
  ];

  for (const dasData of dasPayments) {
    await prisma.dAS.create({ data: dasData });
  }

  console.log('✅ Demo DAS payments created');

  // Create demo notifications
  const notifications = [
    {
      userId: user.id,
      titulo: 'Bem-vindo ao FiscalAI!',
      mensagem: 'Seu assistente fiscal inteligente está pronto para ajudar.',
      tipo: 'info',
      lida: false
    },
    {
      userId: user.id,
      titulo: 'DAS disponível',
      mensagem: 'A guia DAS de janeiro/2025 está disponível para pagamento.',
      tipo: 'alerta',
      lida: false
    }
  ];

  for (const notificationData of notifications) {
    await prisma.notification.create({ data: notificationData });
  }

  console.log('✅ Demo notifications created');

  console.log('\n🎉 Seed completed successfully!');
  console.log('\n📋 Demo credentials:');
  console.log('   Email: demo@fiscalai.com');
  console.log('   Password: demo123');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
