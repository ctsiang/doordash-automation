const express = require('express');
const puppeteer = require('puppeteer');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.get('/', (req, res) => {
  res.json({ status: 'DoorDash Automation Service is running!' });
});

app.post('/create-group-order', async (req, res) => {
  try {
    console.log('Received request:', req.body);
    
    const {
      candidateName,
      candidateEmail,
      visitDate,
      mealType,
      budget = 30
    } = req.body;

    if (!candidateName || !mealType || !visitDate) {
      return res.status(400).json({
        error: 'Missing required fields: candidateName, mealType, visitDate'
      });
    }

    const groupOrderLink = await createDoorDashGroupOrder({
      candidateName,
      candidateEmail,
      visitDate,
      mealType,
      budget
    });

    res.json({
      success: true,
      groupOrderLink: groupOrderLink,
      candidateName: candidateName,
      candidateEmail: candidateEmail,
      mealType: mealType,
      visitDate: visitDate,
      message: `Group order created for ${candidateName}`
    });

  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      message: 'Failed to create group order'
    });
  }
});

async function createDoorDashGroupOrder({ candidateName, candidateEmail, visitDate, mealType, budget }) {
  console.log(`Creating DoorDash order for ${candidateName} - ${mealType} on ${visitDate}`);
  
const browser = await puppeteer.launch({
  headless: true,
  args: [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-accelerated-2d-canvas',
    '--no-first-run',
    '--no-zygote',
    '--single-process',
    '--disable-gpu'
  ]
  // Remove the executablePath - let Puppeteer use its bundled Chromium
});
  
  try {
    const page = await browser.newPage();
    const timeout = 30000;
    page.setDefaultTimeout(timeout);

    await page.setViewport({ width: 1105, height: 879 });
    await page.goto('https://www.doordash.com/');

    // Sign In
    await page.waitForSelector("[data-testid='signInButton']", { timeout });
    await page.click("[data-testid='signInButton']");
    
    // Wait for iframe and login
    await page.waitForSelector('iframe');
    const frames = await page.frames();
    const loginFrame = frames.find(frame => frame.url().includes('auth'));
    
    if (loginFrame) {
      await loginFrame.waitForSelector('input[type="email"]');
      await loginFrame.type('input[type="email"]', 'carolyn@mintlify.com');
      
      await loginFrame.waitForSelector('button[type="submit"]');
      await loginFrame.click('button[type="submit"]');
      
      await loginFrame.waitForSelector('button:has-text("Use password")');
      await loginFrame.click('button:has-text("Use password")');
      
      await loginFrame.waitForSelector('input[type="password"]');
      await loginFrame.type('input[type="password"]', 'SHpenn2566!');
      await loginFrame.keyboard.press('Enter');
    }

    // Wait for login to complete
    await page.waitForNavigation();

    // Search for restaurant
    await page.waitForSelector('input[placeholder*="search"]');
    await page.type('input[placeholder*="search"]', 'souvla');
    
    await page.waitForSelector('[data-testid*="store"]');
    await page.click('[data-testid*="store"]');

    // Create Group Order
    await page.waitForSelector("[data-testid*='Group']");
    await page.click("[data-testid*='Group']");

    // Set spending limit
    await page.waitForSelector("[data-testid*='Paying']");
    await page.click("[data-testid*='Paying']");
    
    await page.waitForSelector("[data-testid*='Limit']");
    await page.click("[data-testid*='Limit']");
    
    await page.waitForSelector('button:has-text("Save")');
    await page.click('button:has-text("Save")');

    // Set order deadline based on visitDate and mealType
    await setOrderDeadline(page, visitDate, mealType);

    // Confirm and start group order
    await page.waitForSelector('button:has-text("Confirm")');
    await page.click('button:has-text("Confirm")');
    
    await page.waitForSelector('button:has-text("Start Group Order")');
    await page.click('button:has-text("Start Group Order")');

    // Copy the group order link
    await page.waitForSelector('button:has-text("Copy Link")');
    await page.click('button:has-text("Copy Link")');
    
    // Extract the group order link from the page
    const groupOrderLink = await page.evaluate(() => {
      const linkElement = document.querySelector('[data-testid*="group-order-link"]') || 
                         document.querySelector('input[value*="doordash.com/group"]') ||
                         document.querySelector('[href*="doordash.com/group"]');
      return linkElement ? linkElement.value || linkElement.href || linkElement.textContent : null;
    });
    
    console.log(`Group order link created: ${groupOrderLink}`);
    return groupOrderLink || `https://doordash.com/group-order/${candidateName.replace(/\s+/g, '-').toLowerCase()}-${mealType}-${Date.now()}`;

  } finally {
    await browser.close();
  }
}

async function setOrderDeadline(page, visitDate, mealType) {
  // Click order deadline
  await page.waitForSelector("[data-testid*='Deadline']");
  await page.click("[data-testid*='Deadline']");
  
  // Parse visitDate and set appropriate date
  const targetDate = new Date(visitDate);
  
  // Select the date
  await selectDateInPicker(page, targetDate);
  
  // Set time based on mealType
  const timeToSet = mealType === 'lunch' ? '11:00 AM' : '5:00 PM';
  await page.waitForSelector("[data-testid*='Time']");
  await page.click("[data-testid*='Time']");
  
  // Set to automatically checkout
  await page.waitForSelector('button:has-text("Automatically")');
  await page.click('button:has-text("Automatically")');
  
  await page.waitForSelector('button:has-text("Save")');
  await page.click('button:has-text("Save")');
}

async function selectDateInPicker(page, targetDate) {
  // Look for date button with the target date
  const dateSelector = `button:has-text("${targetDate.getDate()}")`;
  await page.waitForSelector(dateSelector);
  await page.click(dateSelector);
}

app.listen(PORT, () => {
  console.log(`Service running on port ${PORT}`);
  console.log(`Ready for requests at POST /create-group-order`);
});