// ==========================================================================
// Tikipedia — Hidden Chat Logic
// ==========================================================================

(function () {
    'use strict';

    const API_URL = 'https://polza.ai/api/v1/chat/completions';
    const API_KEY = 'pza_9MNg1O7EaHWUmu_5A_W6zDk7zmvO3eSB';
    const MODEL = 'google/gemini-3.1-flash-lite-preview';

    // State
    let lastAnswer = '';
    let attachedImageBase64 = null;
    let attachedImageType = null;

    // DOM refs
    const trigger = document.getElementById('h-trigger');
    const panel = document.getElementById('h-panel');
    const closeBtn = document.getElementById('h-close');
    const textarea = document.getElementById('h-textarea');
    const sendBtn = document.getElementById('h-send');
    const copyBtn = document.getElementById('h-copy');
    const statusEl = document.getElementById('h-status');
    const loadingEl = document.getElementById('h-loading');
    const imgPreview = document.getElementById('h-image-preview');
    const imgEl = document.getElementById('h-img');
    const imgRemove = document.getElementById('h-img-remove');

    // ---- Toggle panel ----
    function togglePanel() {
        panel.classList.toggle('open');
        if (panel.classList.contains('open')) {
            textarea.focus();
        }
    }

    // Trigger click (footer dot)
    trigger.addEventListener('click', function (e) {
        e.preventDefault();
        togglePanel();
    });

    // ---- 5-tap logo secret gesture (mobile-friendly) ----
    var logoTapCount = 0;
    var logoTapTimer = null;
    var logoEl = document.querySelector('.logo-area svg') || document.querySelector('.logo-area');
    if (logoEl) {
        logoEl.style.cursor = 'pointer';
        logoEl.addEventListener('click', function (e) {
            logoTapCount++;
            if (logoTapCount === 1) {
                logoTapTimer = setTimeout(function () {
                    logoTapCount = 0;
                }, 2000);
            }
            if (logoTapCount >= 5) {
                clearTimeout(logoTapTimer);
                logoTapCount = 0;
                e.preventDefault();
                e.stopPropagation();
                togglePanel();
            }
        });
    }

    // Keyboard shortcuts: Ctrl+Shift+Space or Ctrl+Shift+X
    document.addEventListener('keydown', function (e) {
        if (e.ctrlKey && e.shiftKey && (e.code === 'Space' || e.code === 'KeyX')) {
            e.preventDefault();
            togglePanel();
        }
    });

    // ---- Draggable panel ----
    let isDragging = false;
    let dragOffsetX = 0;
    let dragOffsetY = 0;

    const bar = document.querySelector('.h-bar');

    bar.addEventListener('mousedown', function (e) {
        if (e.target === closeBtn) return;
        isDragging = true;
        const rect = panel.getBoundingClientRect();
        dragOffsetX = e.clientX - rect.left;
        dragOffsetY = e.clientY - rect.top;
        panel.style.transition = 'none';
        bar.style.cursor = 'grabbing';
        e.preventDefault();
    });

    document.addEventListener('mousemove', function (e) {
        if (!isDragging) return;
        let newX = e.clientX - dragOffsetX;
        let newY = e.clientY - dragOffsetY;
        // Clamp to viewport
        const pw = panel.offsetWidth;
        const ph = panel.offsetHeight;
        newX = Math.max(0, Math.min(window.innerWidth - pw, newX));
        newY = Math.max(0, Math.min(window.innerHeight - ph, newY));
        panel.style.left = newX + 'px';
        panel.style.top = newY + 'px';
        panel.style.right = 'auto';
        panel.style.bottom = 'auto';
    });

    document.addEventListener('mouseup', function () {
        if (isDragging) {
            isDragging = false;
            bar.style.cursor = 'grab';
        }
    });

    // Close button
    closeBtn.addEventListener('click', function () {
        panel.classList.remove('open');
    });

    // ---- Image paste (Ctrl+V) ----
    textarea.addEventListener('paste', function (e) {
        const items = e.clipboardData && e.clipboardData.items;
        if (!items) return;

        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            if (item.type.indexOf('image/') === 0) {
                e.preventDefault();
                const blob = item.getAsFile();
                attachedImageType = item.type; // e.g. image/png
                const reader = new FileReader();
                reader.onload = function (ev) {
                    attachedImageBase64 = ev.target.result.split(',')[1]; // strip data:...;base64,
                    imgEl.src = ev.target.result;
                    imgPreview.classList.add('has-image');
                };
                reader.readAsDataURL(blob);
                break;
            }
        }
    });

    // Remove image
    imgRemove.addEventListener('click', function () {
        attachedImageBase64 = null;
        attachedImageType = null;
        imgEl.src = '';
        imgPreview.classList.remove('has-image');
    });

    // ---- Send message ----
    sendBtn.addEventListener('click', sendMessage);
    textarea.addEventListener('keydown', function (e) {
        if (e.ctrlKey && e.key === 'Enter') {
            e.preventDefault();
            sendMessage();
        }
    });

    async function sendMessage() {
        const text = textarea.value.trim();
        if (!text && !attachedImageBase64) return;

        // UI: loading
        sendBtn.disabled = true;
        copyBtn.classList.remove('ready');
        copyBtn.style.display = 'none';
        loadingEl.classList.add('active');
        statusEl.textContent = '';

        try {
            // Build messages
            const content = [];
            if (text) {
                content.push({ type: 'text', text: text });
            }
            if (attachedImageBase64) {
                content.push({
                    type: 'image_url',
                    image_url: {
                        url: 'data:' + (attachedImageType || 'image/png') + ';base64,' + attachedImageBase64
                    }
                });
            }

            const messages = [
                {
                    role: 'system',
                    content: 'Ты помощник. Отвечай точно, конкретно и по существу на вопросы. Если дано задание — реши его полностью. Ответ давай сразу без лишних пояснений.'
                },
                {
                    role: 'user',
                    content: content.length === 1 && content[0].type === 'text' ? content[0].text : content
                }
            ];

            const resp = await fetch(API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + API_KEY
                },
                body: JSON.stringify({
                    model: MODEL,
                    messages: messages,
                    max_tokens: 4096
                })
            });

            if (!resp.ok) {
                const errData = await resp.text();
                throw new Error('API ' + resp.status + ': ' + errData);
            }

            const data = await resp.json();
            lastAnswer = data.choices[0].message.content;

            // Show copy button, no visible answer
            copyBtn.classList.add('ready');
            copyBtn.style.display = 'inline-block';
            statusEl.textContent = '✓';

            // Clear input
            textarea.value = '';
            attachedImageBase64 = null;
            attachedImageType = null;
            imgEl.src = '';
            imgPreview.classList.remove('has-image');

        } catch (err) {
            statusEl.textContent = '✗ ' + err.message;
            console.error('Tikipedia hidden chat error:', err);
        } finally {
            sendBtn.disabled = false;
            loadingEl.classList.remove('active');
        }
    }

    // ---- Copy answer ----
    copyBtn.addEventListener('click', async function () {
        if (!lastAnswer) return;
        try {
            await navigator.clipboard.writeText(lastAnswer);
            const origText = copyBtn.textContent;
            copyBtn.textContent = '✓ Скопировано';
            setTimeout(function () {
                copyBtn.textContent = origText;
            }, 1500);
        } catch (err) {
            // Fallback
            const ta = document.createElement('textarea');
            ta.value = lastAnswer;
            ta.style.position = 'fixed';
            ta.style.opacity = '0';
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            document.body.removeChild(ta);
            const origText = copyBtn.textContent;
            copyBtn.textContent = '✓ Скопировано';
            setTimeout(function () {
                copyBtn.textContent = origText;
            }, 1500);
        }
    });

    // ---- Wikipedia search bar (cosmetic) ----
    const searchForm = document.getElementById('wiki-search-form');
    if (searchForm) {
        searchForm.addEventListener('submit', function (e) {
            e.preventDefault();
            const q = document.getElementById('wiki-search-input').value.trim();
            if (q) {
                window.location.href = 'https://ru.wikipedia.org/wiki/' + encodeURIComponent(q);
            }
        });
    }

})();
