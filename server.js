const express = require('express');
// const puppeteer = require('puppeteer'); // REMOVED FOR TESTING
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

    const groupOrderLink = await createMockDoorDashOrder({
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
      message: `Mock group order created for ${candidateName}`
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

async function createMockDoorDashOrder({ candidateName, candidateEmail, visitDate, mealType, budget }) {
  console.log(`Creating mock order for ${candidateName} - ${mealType} on ${visitDate}`);
  
  // Simulate processing time
  await new Promise(resolve => setTimeout(resolve, 500));
  
  const mockLink = `https://doordash.com/group-order/${candidateName.replace(/\s+/g, '-').toLowerCase()}-${mealType}-${Date.now()}`;
  
  console.log(`Mock link created: ${mockLink}`);
  
  return mockLink;
}

app.listen(PORT, () => {
  console.log(`Service running on port ${PORT}`);
  console.log(`Ready for requests at POST /create-group-order`);
});