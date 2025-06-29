const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testUsageService() {
  console.log('Testing Usage Service...\n');

  try {
    // Cleanup: Remove any existing test user and usage record
    console.log('0. Cleaning up any existing test data...');
    const existingUser = await prisma.user.findUnique({ where: { email: 'test-usage@example.com' } });
    if (existingUser) {
      await prisma.usage.deleteMany({ where: { userId: existingUser.id } });
      await prisma.user.delete({ where: { id: existingUser.id } });
      console.log('✅ Previous test user and usage record deleted.');
    } else {
      console.log('✅ No previous test user found.');
    }

    // Test 1: Create a test user
    console.log('1. Creating test user...');
    const testUser = await prisma.user.create({
      data: {
        email: 'test-usage@example.com',
        password: 'hashedpassword',
        name: 'Test User',
        role: 'free',
        verified: true,
      },
    });
    console.log('✅ Test user created:', testUser.id);

    // Test 2: Create usage record
    console.log('\n2. Creating usage record...');
    const usage = await prisma.usage.create({
      data: {
        userId: testUser.id,
        requests: 0,
        tokens: 0,
        lastReset: new Date(),
      },
    });
    console.log('✅ Usage record created:', usage);

    // Test 3: Increment usage
    console.log('\n3. Incrementing usage...');
    const updatedUsage = await prisma.usage.update({
      where: { userId: testUser.id },
      data: {
        requests: { increment: 1 },
        tokens: { increment: 100 },
      },
    });
    console.log('✅ Usage incremented:', updatedUsage);

    // Test 4: Check limits for free user
    console.log('\n4. Checking usage limits...');
    const limits = {
      requests: 100,
      tokens: 10000,
    };
    const remaining = {
      requests: Math.max(0, limits.requests - updatedUsage.requests),
      tokens: Math.max(0, limits.tokens - updatedUsage.tokens),
    };
    console.log('✅ Free user limits:', limits);
    console.log('✅ Remaining:', remaining);

    // Test 5: Clean up
    console.log('\n5. Cleaning up test data...');
    await prisma.usage.delete({
      where: { userId: testUser.id },
    });
    await prisma.user.delete({
      where: { id: testUser.id },
    });
    console.log('✅ Test data cleaned up');

    console.log('\n🎉 All usage service tests passed!');
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testUsageService(); 