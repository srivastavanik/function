/**
 * Session Monitor
 * Polls Firestore for completed sessions that haven't been processed by the agent
 */

export const sessionMonitor = {
  intervalId: null,
  isRunning: false,
  
  /**
   * Start monitoring for completed sessions
   */
  start: function(firestore, agent) {
    if (this.isRunning) {
      console.log('Session monitor already running');
      return;
    }
    
    console.log('Starting session monitor...');
    this.isRunning = true;
    
    // Poll every 30 seconds
    const POLL_INTERVAL = 30000;
    
    // Initial check
    this.checkSessions(firestore, agent);
    
    // Set up interval
    this.intervalId = setInterval(() => {
      this.checkSessions(firestore, agent);
    }, POLL_INTERVAL);
    
    console.log(`Session monitor started (polling every ${POLL_INTERVAL/1000}s)`);
  },
  
  /**
   * Stop monitoring
   */
  stop: function() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      this.isRunning = false;
      console.log('Session monitor stopped');
    }
  },
  
  /**
   * Check for completed sessions that need processing
   */
  checkSessions: async function(firestore, agent) {
    try {
      // Query for completed sessions that haven't been processed by agent
      const sessionsRef = firestore.collection(process.env.FIRESTORE_COLLECTION_SESSIONS);
      const snapshot = await sessionsRef
        .where('status', '==', 'completed')
        .where('agentProcessed', '!=', true)
        .orderBy('agentProcessed')
        .orderBy('analysisCompleted', 'desc')
        .limit(5)
        .get();
      
      if (!snapshot.empty) {
        console.log(`Found ${snapshot.size} unprocessed sessions`);
        
        // Process each session
        for (const doc of snapshot.docs) {
          const sessionData = doc.data();
          const sessionId = doc.id;
          
          try {
            // Mark as being processed to prevent duplicate processing
            await doc.ref.update({
              agentProcessing: true,
              agentProcessingStarted: new Date(),
            });
            
            // Process with agent
            console.log(`Processing session ${sessionId}`);
            const result = await agent.processSession(sessionId);
            
            // Mark as processed
            await doc.ref.update({
              agentProcessed: true,
              agentProcessing: false,
              agentProcessingCompleted: new Date(),
              agentResult: result,
            });
            
            console.log(`✓ Successfully processed session ${sessionId}`);
            
          } catch (error) {
            console.error(`Error processing session ${sessionId}:`, error);
            
            // Mark as failed
            await doc.ref.update({
              agentProcessing: false,
              agentProcessingError: error.message,
              agentProcessingFailed: new Date(),
            });
          }
        }
      }
    } catch (error) {
      console.error('Error checking sessions:', error);
    }
  },
  
  /**
   * Manually trigger processing for a specific session
   */
  processSession: async function(firestore, agent, sessionId) {
    try {
      const sessionRef = firestore.collection(process.env.FIRESTORE_COLLECTION_SESSIONS).doc(sessionId);
      const doc = await sessionRef.get();
      
      if (!doc.exists) {
        throw new Error(`Session ${sessionId} not found`);
      }
      
      const sessionData = doc.data();
      
      if (sessionData.status !== 'completed') {
        throw new Error(`Session ${sessionId} is not completed yet (status: ${sessionData.status})`);
      }
      
      // Mark as being processed
      await sessionRef.update({
        agentProcessing: true,
        agentProcessingStarted: new Date(),
      });
      
      // Process with agent
      const result = await agent.processSession(sessionId);
      
      // Mark as processed
      await sessionRef.update({
        agentProcessed: true,
        agentProcessing: false,
        agentProcessingCompleted: new Date(),
        agentResult: result,
      });
      
      return result;
      
    } catch (error) {
      // Mark as failed
      try {
        const sessionRef = firestore.collection(process.env.FIRESTORE_COLLECTION_SESSIONS).doc(sessionId);
        await sessionRef.update({
          agentProcessing: false,
          agentProcessingError: error.message,
          agentProcessingFailed: new Date(),
        });
      } catch (updateError) {
        console.error('Error updating session status:', updateError);
      }
      
      throw error;
    }
  },
};
