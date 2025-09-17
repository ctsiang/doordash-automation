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
    headless: true, // Set to false for debugging
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  try {
    const page = await browser.newPage();
    const timeout = 10000;
    page.setDefaultTimeout(timeout);

    await page.setViewport({ width: 1105, height: 879 });
    await page.goto('https://www.doordash.com/');

    // Sign In
    await page.locator("[data-testid='signInButton']").click();
    
    // Wait for iframe and login
    await page.waitForSelector('iframe');
    const frames = await page.frames();
    const loginFrame = frames.find(frame => frame.url().includes('auth'));
    
    if (loginFrame) {
      await loginFrame.locator('#fieldWrapper-\\:r2\\:').fill('carolyn@mintlify.com');
      await loginFrame.locator('#guided-submit-button').click();
      await loginFrame.locator('button.cUfKav').click();
      await loginFrame.locator('#fieldWrapper-\\:ra\\:').fill('SHpenn2566!');
      await loginFrame.keyboard.press('Enter');
    }

    // Wait for login to complete
    await page.waitForNavigation();

    // Search for restaurant
    await page.locator('#fieldWrapper-\\:R1ljkv3ppmn9hjjsq\\:').fill('souvla');
    await page.locator('#store-info-680670').click();

    // Create Group Order
    await page.locator("[data-testid='CreateGroupCartModalButton']").click();

    // Set spending limit
    await page.locator("[data-testid='WhoIsPayingListCell'] span.fOoOkE").click();
    await page.locator("[data-testid='GroupCartLimitOption']").click();
    await page.locator('button.fjNZDh').click();

    // Set order deadline based on visitDate and mealType
    await setOrderDeadline(page, visitDate, mealType);

    // Confirm and start group order
    await page.locator("[data-testid='CreateGroupCartButton']").click();
    await page.locator('button.fjNZDh').click();

    // Copy the group order link
    await page.locator("[data-testid='LAYER-MANAGER-MODAL'] [data-testid='CopyLinkButton']").click();
    
    // Get the link from clipboard or extract from page
    const groupOrderLink = await extractGroupOrderLink(page);
    
    console.log(`Group order link created: ${groupOrderLink}`);
    return groupOrderLink;

  } finally {
    await browser.close();
  }
}

async function setOrderDeadline(page, visitDate, mealType) {
  // Click order deadline
  await page.locator("[data-testid='OrderDeadlineListCell'] span.fOoOkE").click();
  
  // Parse visitDate and set appropriate date
  const targetDate = new Date(visitDate);
  
  // Select the date (you'll need to implement date picker logic)
  await selectDateInPicker(page, targetDate);
  
  // Set time based on mealType
  const timeToSet = mealType === 'lunch' ? '11:00 AM' : '5:00 PM';
  await page.locator("[data-testid='TimePickerDisplay']").click();
  // Implement time selection logic here
  
  // Set to automatically checkout
  await page.locator('span.fnZqAV').click();
  await page.locator('button.bKLkCf').click();
}

async function selectDateInPicker(page, targetDate) {
  // This function needs to be implemented based on DoorDash's date picker
  // For now, using a simple approach - you'll need to enhance this
  const dateButton = await page.locator(`button:has-text("${targetDate.getDate()}")`);
  if (dateButton) {
    await dateButton.click();
  }
}

async function extractGroupOrderLink(page) {
  // Try to get the link from the page after copying
  // This is a simplified approach - you might need to use clipboard API
  const linkElement = await page.locator('[data-testid="group-order-link"]').textContent();
  return linkElement || `https://doordash.com/group-order/mock-${Date.now()}`;
}

app.listen(PORT, () => {
  console.log(`Service running on port ${PORT}`);
  console.log(`Ready for requests at POST /create-group-order`);
});