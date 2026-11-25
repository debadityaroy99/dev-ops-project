document.addEventListener('DOMContentLoaded', () => {
  const loadBoardBtn = document.getElementById('loadBoardBtn');
  const checkHealthBtn = document.getElementById('checkHealthBtn');
  const envBadge = document.getElementById('envBadge');
  const envText = document.getElementById('envText');
  const metaEnv = document.getElementById('metaEnv');
  const metaRelease = document.getElementById('metaRelease');
  const metaRequestId = document.getElementById('metaRequestId');
  const jsonViewer = document.getElementById('jsonViewer');
  const responseStatus = document.getElementById('responseStatus');
  const statusMessage = document.getElementById('statusMessage');
  const cells = document.querySelectorAll('.cell');

  function updateEnvironmentDisplay(env) {
    const normalizedEnv = (env || 'unknown').toLowerCase();
    envBadge.classList.remove('blue', 'green');
    
    if (normalizedEnv === 'blue') {
      envBadge.classList.add('blue');
      envText.textContent = 'ENVIRONMENT: BLUE';
    } else if (normalizedEnv === 'green') {
      envBadge.classList.add('green');
      envText.textContent = 'ENVIRONMENT: GREEN';
    } else {
      envText.textContent = `ENVIRONMENT: ${env.toUpperCase()}`;
    }
    metaEnv.textContent = env || '-';
  }

  function renderBoard(board) {
    if (!board || !Array.isArray(board)) return;
    
    let index = 0;
    for (let r = 0; r < board.length && r < 3; r++) {
      for (let c = 0; c < board[r].length && c < 3; c++) {
        const val = board[r][c] || ' ';
        const cell = cells[index++];
        if (cell) {
          cell.textContent = val.trim() === '' ? '-' : val;
          cell.setAttribute('data-value', val.trim());
          if (val.trim() !== '') {
            cell.classList.add('filled');
          } else {
            cell.classList.remove('filled');
          }
        }
      }
    }
  }

  async function loadReferenceBoard() {
    statusMessage.textContent = 'Fetching reference board...';
    statusMessage.className = 'status-message';
    responseStatus.textContent = 'FETCHING...';

    try {
      const response = await fetch('/api/boards/reference', {
        headers: {
          'Accept': 'application/json'
        }
      });

      // Extract tracing headers
      const headerReqId = response.headers.get('X-Request-ID');
      const headerEnv = response.headers.get('X-Environment');
      const headerRelease = response.headers.get('X-Release');

      responseStatus.textContent = `HTTP ${response.status} ${response.statusText}`;

      if (!response.ok) {
        throw new Error(`API responded with HTTP ${response.status}`);
      }

      const data = await response.json();

      // Update board cells
      renderBoard(data.board);

      // Update environment badge and metadata fields
      const currentEnv = data.environment || headerEnv || 'blue';
      updateEnvironmentDisplay(currentEnv);

      metaRelease.textContent = data.release || headerRelease || '-';
      metaRequestId.textContent = data.requestId || headerReqId || '-';

      // Pretty-print response JSON
      jsonViewer.textContent = JSON.stringify(data, null, 2);

      statusMessage.textContent = `Successfully loaded board with Request ID: ${data.requestId}`;
      statusMessage.className = 'status-message success';
    } catch (err) {
      console.error('Error fetching reference board:', err);
      responseStatus.textContent = 'ERROR';
      jsonViewer.textContent = JSON.stringify({ error: err.message }, null, 2);
      statusMessage.textContent = `Failed to load board: ${err.message}`;
      statusMessage.className = 'status-message error';
    }
  }

  async function checkHealth() {
    statusMessage.textContent = 'Checking /healthz...';
    statusMessage.className = 'status-message';
    try {
      const response = await fetch('/healthz');
      const text = await response.text();
      statusMessage.textContent = `Health Probe: HTTP ${response.status} - "${text}"`;
      statusMessage.className = 'status-message success';
    } catch (err) {
      statusMessage.textContent = `Health check failed: ${err.message}`;
      statusMessage.className = 'status-message error';
    }
  }

  loadBoardBtn.addEventListener('click', loadReferenceBoard);
  checkHealthBtn.addEventListener('click', checkHealth);

  // Automatically load the reference board on first page load
  loadReferenceBoard();
});
