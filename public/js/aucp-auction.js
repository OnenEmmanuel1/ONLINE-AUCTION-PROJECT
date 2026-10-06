/**
 * BidSecure — Live Auction Polling Script (aucp-auction.js)
 * Updates current highest bid, time remaining, and bid history via JSON API polling.
 */

class AucpLiveAuction {
  constructor(listingId, endTimestamp) {
    this.listingId = listingId;
    this.endTimestamp = new Date(endTimestamp).getTime();
    this.pollIntervalMs = 5000; // 5 seconds polling
    this.timerInterval = null;
    this.pollInterval = null;

    this.highestBidElement = document.getElementById('highestBidValue');
    this.minBidNoticeElement = document.getElementById('minBidNotice');
    this.timerDisplayElement = document.getElementById('timerDisplay');
    this.bidHistoryTableBody = document.getElementById('bidHistoryBody');
    this.bidForm = document.getElementById('placeBidForm');
    this.bidAlertBox = document.getElementById('bidAlertBox');

    this.init();
  }

  init() {
    this.startCountdown();
    this.startPolling();
    this.bindBidForm();
  }

  startCountdown() {
    const updateTimer = () => {
      const now = new Date().getTime();
      const distance = this.endTimestamp - now;

      if (distance <= 0) {
        if (this.timerDisplayElement) {
          this.timerDisplayElement.innerHTML = 'AUCTION CLOSED';
          this.timerDisplayElement.style.color = '#E02424';
        }
        clearInterval(this.timerInterval);
        clearInterval(this.pollInterval);
        if (this.bidForm) {
          const submitBtn = this.bidForm.querySelector('button[type="submit"]');
          if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.innerText = 'Bidding Ended';
          }
        }
        return;
      }

      const days = Math.floor(distance / (1000 * 60 * 60 * 24));
      const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((distance % (1000 * 60)) / 1000);

      let formatted = '';
      if (days > 0) formatted += `${days}d `;
      formatted += `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

      if (this.timerDisplayElement) {
        this.timerDisplayElement.innerText = formatted;
      }
    };

    updateTimer();
    this.timerInterval = setInterval(updateTimer, 1000);
  }

  startPolling() {
    const fetchUpdates = async () => {
      try {
        const response = await fetch(`/api/bids/${this.listingId}/live`);
        if (!response.ok) return;
        const data = await response.json();

        if (data.success) {
          this.updateDOM(data);
        }
      } catch (err) {
        console.warn('[AucpLiveAuction] Polling sync skipped:', err.message);
      }
    };

    this.pollInterval = setInterval(fetchUpdates, this.pollIntervalMs);
  }

  updateDOM(data) {
    const highest = parseFloat(data.currentHighestBid);
    const minBidRequired = highest + 1.00;

    if (this.highestBidElement) {
      this.highestBidElement.innerText = `₦${highest.toLocaleString('en-NG', { minimumFractionDigits: 2 })}`;
    }

    if (this.minBidNoticeElement) {
      this.minBidNoticeElement.innerText = `Minimum required next bid: ₦${minBidRequired.toLocaleString('en-NG', { minimumFractionDigits: 2 })}`;
    }

    // Update bid history table
    if (this.bidHistoryTableBody && Array.isArray(data.bids)) {
      if (data.bids.length === 0) {
        this.bidHistoryTableBody.innerHTML = `<tr><td colspan="4" style="text-align:center; color:#9CA3AF;">No bids placed yet. Be the first!</td></tr>`;
      } else {
        this.bidHistoryTableBody.innerHTML = data.bids.map((bid, index) => {
          const isHighest = index === 0;
          const placedAt = new Date(bid.placed_at).toLocaleString();
          return `
            <tr class="${isHighest ? 'aucp-table-row-highlight' : ''}">
              <td>${index + 1}</td>
              <td><strong>${this.escapeHTML(bid.bidder_name)}</strong></td>
              <td>₦${parseFloat(bid.amount).toLocaleString('en-NG', { minimumFractionDigits: 2 })}</td>
              <td>${placedAt} ${isHighest ? '<span class="aucp-badge aucp-badge-active" style="margin-left:6px;">Highest</span>' : ''}</td>
            </tr>
          `;
        }).join('');
      }
    }
  }

  bindBidForm() {
    if (!this.bidForm) return;

    this.bidForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const amountInput = this.bidForm.querySelector('input[name="amount"]');
      const submitBtn = this.bidForm.querySelector('button[type="submit"]');

      if (!amountInput) return;
      const amount = parseFloat(amountInput.value);

      submitBtn.disabled = true;
      submitBtn.innerText = 'Submitting Bid...';
      this.showAlert('', 'hide');

      try {
        const response = await fetch(`/api/bids/${this.listingId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ amount })
        });

        const result = await response.json();

        if (result.success) {
          this.showAlert(result.message || 'Bid submitted successfully!', 'success');
          amountInput.value = '';
          // Immediate poll update
          const liveRes = await fetch(`/api/bids/${this.listingId}/live`);
          const liveData = await liveRes.json();
          if (liveData.success) this.updateDOM(liveData);
        } else {
          this.showAlert(result.message || 'Failed to place bid.', 'danger');
        }
      } catch (err) {
        this.showAlert('Network error trying to place bid.', 'danger');
      } finally {
        submitBtn.disabled = false;
        submitBtn.innerText = 'Place Bid Now';
      }
    });
  }

  showAlert(message, type) {
    if (!this.bidAlertBox) return;
    if (type === 'hide') {
      this.bidAlertBox.style.display = 'none';
      return;
    }

    this.bidAlertBox.className = `aucp-alert aucp-alert-${type}`;
    this.bidAlertBox.innerText = message;
    this.bidAlertBox.style.display = 'block';
  }

  escapeHTML(str) {
    return String(str || '').replace(/[&<>"']/g, match => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[match]);
  }
}
