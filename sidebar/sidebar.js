const extractBtn = document.getElementById('extract-btn');
const statusDiv = document.getElementById('status-message');
const openRecentBtn = document.getElementById('open-recent-btn');
const openHistoryBtn = document.getElementById('open-history-btn');

extractBtn.addEventListener('click', async () => {
  extractBtn.disabled = true;
  statusDiv.textContent = 'Sending request...';
  statusDiv.className = '';

  try {
    const [activeTab] = await browser.tabs.query({ active: true, currentWindow: true });

    if (!activeTab || !activeTab.url?.startsWith("http")) {
      throw new Error("Can only run on a valid web page.");
    }

    // 1. Generate a unique ID for this task on the client-side.
    const task = {
      id: 'task_' + Date.now(),
      url: activeTab.url,
      status: 'queued', // Initial status
      submittedAt: new Date().toISOString(),
      data: null, // No data yet
      error: null
    };

    // 2. Save the initial task object to storage.
    await browser.storage.local.set({ [task.id]: task });

    // 3. Send a message to the background script to start processing.
    browser.runtime.sendMessage({ action: 'processJob', task: task });

    // 4. Provide instant feedback to the user.
    statusDiv.textContent = '✅ Request sent! Processing in background.';
    statusDiv.className = 'success';

  } catch (error) {
    statusDiv.textContent = `Error: ${error.message}`;
    statusDiv.className = 'error';
  } finally {
    // Re-enable the button after a short delay.
    setTimeout(() => {
      extractBtn.disabled = false;
    }, 1500);
  }
});

// Open Recent and History pages in new tabs
function openRelativePage(path) {
  // Sidebar is within sidebar/, go up one level to extension root
  const url = browser.runtime.getURL(path);
  browser.tabs.create({ url });
}

openRecentBtn?.addEventListener('click', () => openRelativePage('recent/recent.html'));
openHistoryBtn?.addEventListener('click', () => openRelativePage('history/history.html'));