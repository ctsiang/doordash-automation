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

    // Sign In - using your original recorded selector
    await page.waitForSelector("[data-testid='signInButton']");
    await page.click("[data-testid='signInButton']");
    
    // Wait for iframe and login
    await page.waitForTimeout(3000);
    const frames = await page.frames();
    const loginFrame = frames.find(frame => frame.url().includes('auth') || frame.url().includes('login'));
    
    if (loginFrame) {
      // Fill email - using original selector pattern
      await loginFrame.waitForSelector('#fieldWrapper-\\:r2\\:', { timeout: 10000 });
      await loginFrame.type('#fieldWrapper-\\:r2\\:', 'carolyn@mintlify.com');
      
      // Click continue button
      await loginFrame.waitForSelector('#guided-submit-button');
      await loginFrame.click('#guided-submit-button');
      await page.waitForTimeout(2000);
      
      // Click "Use password" - using original recorded selector
      try {
        await loginFrame.waitForSelector('button.cUfKav', { timeout: 5000 });
        await loginFrame.click('button.cUfKav');
      } catch (e) {
        console.log('Password button not found, trying alternative approach');
      }
      
      // Fill password - using original selector pattern
      await loginFrame.waitForSelector('#fieldWrapper-\\:ra\\:');
      await loginFrame.type('#fieldWrapper-\\:ra\\:', 'SHpenn2566!');
      await loginFrame.keyboard.press('Enter');
    }

    // Wait for login to complete
    await page.waitForTimeout(5000);

    // Search for restaurant - using original selector
    await page.waitForSelector('#fieldWrapper-\\:R1ljkv3ppmn9hjjsq\\:');
    await page.type('#fieldWrapper-\\:R1ljkv3ppmn9hjjsq\\:', 'souvla');
    await page.waitForTimeout(2000);
    
    // Click on the specific Souvla store - using original ID
    await page.waitForSelector('#store-info-680670');
    await page.click('#store-info-680670');

    // Create Group Order - using original recorded selector
    await page.waitForSelector("[data-testid='CreateGroupCartModalButton']");
    await page.click("[data-testid='CreateGroupCartModalButton']");

    // Set spending limit - using original selectors
    await page.waitForSelector("[data-testid='WhoIsPayingListCell'] span.fOoOkE");
    await page.click("[data-testid='WhoIsPayingListCell'] span.fOoOkE");
    
    await page.waitForSelector("[data-testid='GroupCartLimitOption']");
    await page.click("[data-testid='GroupCartLimitOption']");
    
    await page.waitForSelector('button.fjNZDh');
    await page.click('button.fjNZDh');

    // Set order deadline based on visitDate and mealType
    await setOrderDeadline(page, visitDate, mealType);

    // Confirm and start group order - using original selectors
    await page.waitForSelector("[data-testid='CreateGroupCartButton']");
    await page.click("[data-testid='CreateGroupCartButton']");
    
    await page.waitForSelector('button.fjNZDh');
    await page.click('button.fjNZDh');
    await page.waitForTimeout(3000);

    // Copy the group order link - find copy button
    await page.waitForSelector("[data-testid='LAYER-MANAGER-MODAL']");
    
    // Look for copy link button with multiple approaches
    const copyButtonSelectors = [
      "button:contains('Copy Link')",
      "[data-testid*='copy']",
      "[data-testid*='link']",
      "button[aria-label*='copy']"
    ];
    
    // Use page.evaluate to find and click copy button
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button, [role="button"]'));
      const copyButton = buttons.find(btn => 
        btn.textContent && btn.textContent.toLowerCase().includes('copy')
      );
      if (copyButton) copyButton.click();
    });
    
    // Extract the group order link from the page
    const groupOrderLink = await page.evaluate(() => {
      // Try multiple ways to find the group order link
      const inputs = Array.from(document.querySelectorAll('input'));
      for (let input of inputs) {
        if (input.value && input.value.includes('doordash.com/group')) {
          return input.value;
        }
      }
      
      const links = Array.from(document.querySelectorAll('a'));
      for (let link of links) {
        if (link.href && link.href.includes('doordash.com/group')) {
          return link.href;
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
    // Click order deadline - using original selector
    await page.waitForSelector("[data-testid='OrderDeadlineListCell'] span.fOoOkE");
    await page.click("[data-testid='OrderDeadlineListCell'] span.fOoOkE");
    
    // Parse visitDate and set appropriate date
    const targetDate = new Date(visitDate);
    await selectDateInPicker(page, targetDate);
    
    // Set time based on mealType - using original selector
    await page.waitForSelector("[data-testid='TimePickerDisplay']");
    await page.click("[data-testid='TimePickerDisplay']");
    
    // Set to automatically checkout - using original selector
    await page.waitForSelector('span.fnZqAV');
    await page.click('span.fnZqAV');
    
    await page.waitForSelector('button.bKLkCf');
    await page.click('button.bKLkCf');
  } catch (error) {
    console.log('Error setting deadline, continuing with defaults:', error.message);
  }
}

async function selectDateInPicker(page, targetDate) {
  try {
    // Look for date button with the target date
    const dateText = targetDate.getDate().toString();
    
    // Use page.evaluate to find and click the date
    await page.evaluate((dateToFind) => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const dateButton = buttons.find(btn => 
        btn.textContent && btn.textContent.trim() === dateToFind
      );
      if (dateButton) dateButton.click();
    }, dateText);
    
  } catch (error) {
    console.log('Error selecting date:', error.message);
  }
}

app.listen(PORT, () => {
  console.log(`Service running on port ${PORT}`);
  console.log(`Ready for requests at POST /create-group-order`);
});