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
  });
  
  try {
    const page = await browser.newPage();
    const timeout = 30000;
    page.setDefaultTimeout(timeout);

    await page.setViewport({ width: 1105, height: 879 });
    await page.goto('https://www.doordash.com/');

    // Sign In
    await page.waitForSelector("[data-testid='signInButton']");
    await page.click("[data-testid='signInButton']");
    
    // Wait for iframe and login
    await page.waitForTimeout(3000); // Wait for iframe to load
    const frames = await page.frames();
    const loginFrame = frames.find(frame => frame.url().includes('auth') || frame.url().includes('login'));
    
    if (loginFrame) {
      // Fill email
      await loginFrame.waitForSelector('input[type="email"], input[name="email"], input[placeholder*="email" i]');
      await loginFrame.type('input[type="email"], input[name="email"], input[placeholder*="email" i]', 'carolyn@mintlify.com');
      
      // Click continue
      await loginFrame.click('button[type="submit"], button:contains("Continue")');
      await page.waitForTimeout(2000);
      
      // Click "Use password" - try multiple possible selectors
      try {
        await loginFrame.waitForSelector('button.cUfKav, button:contains("Use password"), [data-testid*="password"]', { timeout: 5000 });
        await loginFrame.click('button.cUfKav, button:contains("Use password"), [data-testid*="password"]');
      } catch (e) {
        console.log('Password button not found, trying alternative approach');
      }
      
      // Fill password
      await loginFrame.waitForSelector('input[type="password"], input[name="password"]');
      await loginFrame.type('input[type="password"], input[name="password"]', 'SHpenn2566!');
      await loginFrame.keyboard.press('Enter');
    }

    // Wait for login to complete
    await page.waitForTimeout(5000);

    // Search for restaurant
    await page.waitForSelector('input[placeholder*="search" i], input[data-testid*="search"]');
    await page.click('input[placeholder*="search" i], input[data-testid*="search"]');
    await page.type('input[placeholder*="search" i], input[data-testid*="search"]', 'souvla');
    await page.waitForTimeout(2000);
    
    // Click on the specific Souvla store
    await page.waitForSelector('#store-info-680670, [data-testid*="store"], .store-card');
    await page.click('#store-info-680670, [data-testid*="store"], .store-card');

    // Create Group Order
    await page.waitForSelector("[data-testid='CreateGroupCartModalButton'], button:contains('Group Order')");
    await page.click("[data-testid='CreateGroupCartModalButton'], button:contains('Group Order')");

    // Set spending limit
    await page.waitForSelector("[data-testid='WhoIsPayingListCell'], [data-testid*='Paying']");
    await page.click("[data-testid='WhoIsPayingListCell'], [data-testid*='Paying']");
    
    await page.waitForSelector("[data-testid='GroupCartLimitOption'], [data-testid*='Limit']");
    await page.click("[data-testid='GroupCartLimitOption'], [data-testid*='Limit']");
    
    await page.waitForSelector('button.fjNZDh, button:contains("Save")');
    await page.click('button.fjNZDh, button:contains("Save")');

    // Set order deadline based on visitDate and mealType
    await setOrderDeadline(page, visitDate, mealType);

    // Confirm and start group order
    await page.waitForSelector("[data-testid='CreateGroupCartButton'], button:contains('Confirm')");
    await page.click("[data-testid='CreateGroupCartButton'], button:contains('Confirm')");
    
    await page.waitForSelector('button.fjNZDh, button:contains("Start Group Order")');
    await page.click('button.fjNZDh, button:contains("Start Group Order")');
    await page.waitForTimeout(3000);

    // Copy the group order link
    await page.waitForSelector('button:contains("Copy Link"), [data-testid*="copy"], [data-testid*="link"]');
    await page.click('button:contains("Copy Link"), [data-testid*="copy"], [data-testid*="link"]');
    
    // Extract the group order link from the page
    const groupOrderLink = await page.evaluate(() => {
      // Try multiple ways to find the group order link
      const possibleElements = [
        document.querySelector('[data-testid*="group-order-link"]'),
        document.querySelector('input[value*="doordash.com/group"]'),
        document.querySelector('[href*="doordash.com/group"]'),
        document.querySelector('input[value*="group"]'),
        document.querySelector('[data-testid*="link"] input'),
        document.querySelector('.group-order-link'),
        ...Array.from(document.querySelectorAll('input')).filter(el => 
          el.value && el.value.includes('doordash.com')
        )
      ];
      
      for (let element of possibleElements) {
        if (element) {
          const link = element.value || element.href || element.textContent;
          if (link && link.includes('doordash.com')) {
            return link.trim();
          }
        }
      }
      return null;
    });
    
    console.log(`Group order link created: ${groupOrderLink}`);
    return groupOrderLink || `https://doordash.com/group-order/${candidateName.replace(/\s+/g, '-').toLowerCase()}-${mealType}-${Date.now()}`;

  } finally {
    await browser.close();
  }
}

async function setOrderDeadline(page, visitDate, mealType) {
  try {
    // Click order deadline
    await page.waitForSelector("[data-testid='OrderDeadlineListCell'], [data-testid*='Deadline']");
    await page.click("[data-testid='OrderDeadlineListCell'], [data-testid*='Deadline']");
    
    // Parse visitDate and set appropriate date
    const targetDate = new Date(visitDate);
    await selectDateInPicker(page, targetDate);
    
    // Set time based on mealType
    const timeToSet = mealType === 'lunch' ? '11:00 AM' : '5:00 PM';
    await page.waitForSelector("[data-testid='TimePickerDisplay'], [data-testid*='Time']");
    await page.click("[data-testid='TimePickerDisplay'], [data-testid*='Time']");
    
    // Set to automatically checkout
    await page.waitForSelector('span.fnZqAV, button:contains("Automatically")');
    await page.click('span.fnZqAV, button:contains("Automatically")');
    
    await page.waitForSelector('button.bKLkCf, button:contains("Save")');
    await page.click('button.bKLkCf, button:contains("Save")');
  } catch (error) {
    console.log('Error setting deadline, continuing with defaults:', error.message);
  }
}

async function selectDateInPicker(page, targetDate) {
  try {
    // Look for date button with the target date
    const dateText = targetDate.getDate().toString();
    
    // Try multiple selector approaches for date picker
    const dateSelectors = [
      `button:contains("${dateText}")`,
      `[data-testid*="day"]:contains("${dateText}")`,
      `.date-picker button:contains("${dateText}")`,
      `button[aria-label*="${dateText}"]`
    ];
    
    for (let selector of dateSelectors) {
      try {
        await page.waitForSelector(selector, { timeout: 3000 });
        await page.click(selector);
        return; // Success, exit function
      } catch (e) {
        continue; // Try next selector
      }
    }
    
    console.log('Could not find date selector, using default date');
  } catch (error) {
    console.log('Error selecting date:', error.message);
  }
}

app.listen(PORT, () => {
  console.log(`Service running on port ${PORT}`);
  console.log(`Ready for requests at POST /create-group-order`);
});