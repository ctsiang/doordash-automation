// server.js - Your DoorDash automation service
const express = require('express');
const puppeteer = require('puppeteer');
const app = express();
const PORT = process.env.PORT || 3000;

// Enable JSON parsing
app.use(express.json());

// Health check endpoint
app.get('/', (req, res) => {
  res.json({ status: 'DoorDash Automation Service is running!' });
});

// Main endpoint for creating DoorDash group orders
app.post('/create-group-order', async (req, res) => {
  try {
    console.log('📝 Received request from n8n:', req.body);
    
    // Get data from n8n
    const {
      candidateName,
      candidateEmail,
      visitDate,
      mealType, // 'lunch' or 'dinner'
      budget = 30 // default budget
    } = req.body;

    // Validate required fields
    if (!candidateName || !mealType || !visitDate) {
      return res.status(400).json({
        error: 'Missing required fields: candidateName, mealType, visitDate'
      });
    }

    console.log(`🚀 Creating DoorDash group order for ${candidateName}...`);

    const groupOrderLink = await createDoorDashGroupOrder({
      candidateName,
      candidateEmail,
      visitDate,
      mealType,
      budget
    });

    console.log(`✅ Successfully created group order: ${groupOrderLink}`);

    // Return the link to n8n
    res.json({
      success: true,
      groupOrderLink: groupOrderLink,
      candidateName: candidateName,
      candidateEmail: candidateEmail,
      mealType: mealType,
      visitDate: visitDate,
      message: `Group order created successfully for ${candidateName}`
    });

  } catch (error) {
    console.error('❌ Error creating group order:', error);
    
    res.status(500).json({
      success: false,
      error: error.message,
      message: 'Failed to create DoorDash group order'
    });
  }
});

async function createDoorDashGroupOrder({ candidateName, candidateEmail, visitDate, mealType, budget }) {
  let browser = null;
  
  try {
    // Launch browser with production settings
    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu',
        '--no-first-run',
        '--no-zygote',
        '--single-process',
        '--disable-extensions'
      ]
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 720 });

    // Step 1: Go to DoorDash
    console.log('📍 Step 1: Navigating to DoorDash...');
    await page.goto('https://www.doordash.com', { 
      waitUntil: 'networkidle2',
      timeout: 30000 
    });

    // Step 2: Sign in
    console.log('📍 Step 2: Looking for sign-in button...');
    
    // Try to find sign-in button (you'll need to update these selectors based on recording)
    const signInSelectors = [
      '[data-anchor-id="LoginButton"]',
      'button[aria-label*="Log in"]',
      '[data-testid="signin-button"]',
      'a[href*="login"]',
      'button:has-text("Sign In")',
      'button:has-text("Log In")'
    ];

    let signInClicked = false;
    for (const selector of signInSelectors) {
      try {
        const element = await page.$(selector);
        if (element) {
          await element.click();
          signInClicked = true;
          console.log(`✅ Clicked sign-in with selector: ${selector}`);
          await page.waitForTimeout(2000);
          break;
        }
      } catch (e) {
        console.log(`❌ Sign-in selector ${selector} failed:`, e.message);
      }
    }

    if (!signInClicked) {
      throw new Error('Could not find sign-in button');
    }

    // Step 3: Enter credentials
    console.log('📍 Step 3: Entering credentials...');
    
    const emailSelectors = [
      'input[name="email"]',
      'input[type="email"]',
      'input[placeholder*="email"]',
      'input[id*="email"]',
      '[data-testid="email-input"]'
    ];

    let emailEntered = false;
    for (const selector of emailSelectors) {
      try {
        await page.waitForSelector(selector, { timeout: 10000 });
        await page.type(selector, process.env.DOORDASH_EMAIL);
        emailEntered = true;
        console.log(`✅ Entered email with selector: ${selector}`);
        break;
      } catch (e) {
        console.log(`❌ Email selector ${selector} failed:`, e.message);
      }
    }

    if (!emailEntered) {
      throw new Error('Could not find email input field');
    }

    const passwordSelectors = [
      'input[name="password"]',
      'input[type="password"]',
      'input[id*="password"]',
      '[data-testid="password-input"]'
    ];

    let passwordEntered = false;
    for (const selector of passwordSelectors) {
      try {
        const element = await page.$(selector);
        if (element) {
          await page.type(selector, process.env.DOORDASH_PASSWORD);
          passwordEntered = true;
          console.log(`✅ Entered password with selector: ${selector}`);
          break;
        }
      } catch (e) {
        console.log(`❌ Password selector ${selector} failed:`, e.message);
      }
    }

    if (!passwordEntered) {
      throw new Error('Could not find password input field');
    }

    // Click login button
    const loginButtonSelectors = [
      'button[type="submit"]',
      'button:has-text("Sign In")',
      'button:has-text("Log In")',
      '[data-testid="login-button"]',
      '[data-testid="signin-submit-button"]'
    ];

    let loginClicked = false;
    for (const selector of loginButtonSelectors) {
      try {
        const element = await page.$(selector);
        if (element) {
          await element.click();
          loginClicked = true;
          console.log(`✅ Clicked login with selector: ${selector}`);
          break;
        }
      } catch (e) {
        console.log(`❌ Login button selector ${selector} failed:`, e.message);
      }
    }

    if (!loginClicked) {
      throw new Error('Could not find login button');
    }

    // Wait for login to complete
    try {
      await page.waitForNavigation({ 
        waitUntil: 'networkidle2',
        timeout: 30000 
      });
      console.log('✅ Login successful');
    } catch (e) {
      console.log('⚠️  Navigation timeout, but continuing...');
    }

    console.log('📍 Step 4: Looking for Group Order functionality...');

    // For now, return a mock link while you set up the real selectors
    // This lets you test the whole flow before dealing with DoorDash complexity
    const mockGroupOrderLink = `https://doordash.com/group-order/mock-${candidateName.replace(/\s+/g, '-').toLowerCase()}-${Date.now()}`;
    
    console.log('🚧 MOCK MODE: Returning test link for initial setup');
    console.log('🚧 You need to replace this with real DoorDash group order creation');
    
    return mockGroupOrderLink;

    // TODO: Replace the above mock with real group order creation
    // You'll need to record the actual DoorDash steps and update these selectors:
    
    /*
    // Step 4: Navigate to Group Order
    const groupOrderSelectors = [
      '[data-testid*="group"]',
      'a[href*="group"]',
      'button[aria-label*="Group Order"]'
    ];
    
    let groupOrderButton = null;
    for (const selector of groupOrderSelectors) {
      try {
        groupOrderButton = await page.$(selector);
        if (groupOrderButton) {
          await groupOrderButton.click();
          console.log(`✅ Clicked group order with selector: ${selector}`);
          await page.waitForTimeout(3000);
          break;
        }
      } catch (e) {
        console.log(`❌ Group order selector ${selector} failed:`, e.message);
      }
    }
    
    if (!groupOrderButton) {
      throw new Error('Could not find group order functionality');
    }
    
    // Step 5: Fill in group order details
    const groupName = `${mealType === 'lunch' ? 'Lunch' : 'Dinner'} Interview - ${candidateName} - ${visitDate}`;
    
    const groupNameSelectors = [
      'input[name*="group"]',
      'input[placeholder*="group name"]',
      '[data-testid*="group-name"]'
    ];
    
    for (const selector of groupNameSelectors) {
      try {
        const element = await page.$(selector);
        if (element) {
          await page.type(selector, groupName);
          console.log(`✅ Entered group name with selector: ${selector}`);
          break;
        }
      } catch (e) {
        console.log(`❌ Group name selector ${selector} failed:`, e.message);
      }
    }
    
    // Step 6: Set checkout time
    const checkoutTime = mealType === 'lunch' ? '11:00 AM' : '5:00 PM';
    // Add selectors for time setting...
    
    // Step 7: Set budget
    // Add selectors for budget setting...
    
    // Step 8: Create order and get link
    // Add selectors for creating order and extracting link...
    
    return actualGroupOrderLink;
    */

  } catch (error) {
    console.error('Error in DoorDash automation:', error);
    throw error;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

app.listen(PORT, () => {
  console.log(`🚀 DoorDash Automation Service running on port ${PORT}`);
  console.log(`📝 Ready to receive requests at POST /create-group-order`);
  console.log(`🌐 Health check available at GET /`);
  
  if (!process.env.DOORDASH_EMAIL || !process.env.DOORDASH_PASSWORD) {
    console.log('⚠️  WARNING: DoorDash credentials not set in environment variables');
    console.log('⚠️  Set DOORDASH_EMAIL and DOORDASH_PASSWORD in your deployment platform');
  } else {
    console.log('✅ DoorDash credentials found');
  }
});