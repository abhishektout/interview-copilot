import { describe, it, expect, beforeEach } from 'vitest';
import { useInterviewStore, useAppStore } from '../../src/stores';

describe('Zustand Stores', () => {
  beforeEach(() => {
    useInterviewStore.getState().stopInterview();
    useInterviewStore.setState({ qaHistory: [], elapsedSeconds: 0 });
    useAppStore.setState({
      isInitialized: false,
      settings: null,
      isGeminiConnected: false,
      currentPage: 'dashboard',
    });
  });

  describe('useAppStore', () => {
    it('updates initialization and Gemini connected state', () => {
      expect(useAppStore.getState().isInitialized).toBe(false);
      useAppStore.getState().setInitialized(true);
      expect(useAppStore.getState().isInitialized).toBe(true);

      useAppStore.getState().setGeminiConnected(true);
      expect(useAppStore.getState().isGeminiConnected).toBe(true);
    });

    it('changes current page navigation', () => {
      useAppStore.getState().setCurrentPage('settings');
      expect(useAppStore.getState().currentPage).toBe('settings');
    });
  });

  describe('useInterviewStore', () => {
    it('manages interview running and paused states', () => {
      const { startInterview, pauseInterview, stopInterview } = useInterviewStore.getState();

      startInterview();
      expect(useInterviewStore.getState().isRunning).toBe(true);
      expect(useInterviewStore.getState().isPaused).toBe(false);

      pauseInterview();
      expect(useInterviewStore.getState().isPaused).toBe(true);

      pauseInterview();
      expect(useInterviewStore.getState().isPaused).toBe(false);

      stopInterview();
      expect(useInterviewStore.getState().isRunning).toBe(false);
    });

    it('tracks transcript and question state', () => {
      const { setTranscript, setCurrentQuestion, setSuggestedAnswer } = useInterviewStore.getState();

      setTranscript('Hello this is a test transcript chunk.');
      expect(useInterviewStore.getState().transcript).toBe('Hello this is a test transcript chunk.');

      setCurrentQuestion('How do you scale WebSocket connections?', 'system-design');
      expect(useInterviewStore.getState().currentQuestion).toBe('How do you scale WebSocket connections?');
      expect(useInterviewStore.getState().currentQuestionType).toBe('system-design');

      setSuggestedAnswer('You can scale WebSockets using Redis pub/sub and sticky sessions.');
      expect(useInterviewStore.getState().suggestedAnswer).toContain('Redis pub/sub');
    });

    it('records Q&A items in history and streaming chunks', () => {
      const { addToHistory, appendStreamChunk, finalizeStreamAnswer } = useInterviewStore.getState();

      // Test streaming answer accumulation
      appendStreamChunk('Step 1: Partition by user ID. ');
      appendStreamChunk('Step 2: Use Kafka broker.');
      expect(useInterviewStore.getState().streamingAnswer).toBe('Step 1: Partition by user ID. Step 2: Use Kafka broker.');
      expect(useInterviewStore.getState().isGenerating).toBe(true);

      finalizeStreamAnswer();
      expect(useInterviewStore.getState().suggestedAnswer).toBe('Step 1: Partition by user ID. Step 2: Use Kafka broker.');
      expect(useInterviewStore.getState().streamingAnswer).toBe('');
      expect(useInterviewStore.getState().isGenerating).toBe(false);

      // Add to QA history
      addToHistory({
        question: 'What is CORS?',
        answer: 'Cross-Origin Resource Sharing is an HTTP-header based security mechanism...',
        score: 95,
      });

      expect(useInterviewStore.getState().qaHistory.length).toBe(1);
      expect(useInterviewStore.getState().qaHistory[0].question).toBe('What is CORS?');
      expect(useInterviewStore.getState().qaHistory[0].score).toBe(95);
    });
  });
});
