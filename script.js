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
    let attachedImages = []; // [{base64, type, dataUrl}]
    let attachedFiles = [];  // [{name, content (text)}]

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
    const fileInput = document.getElementById('h-file-input');
    const attachBtn = document.getElementById('h-attach-btn');

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

    // ---- Render all attachment previews ----
    function renderPreviews() {
        imgPreview.innerHTML = '';
        var totalItems = attachedImages.length + attachedFiles.length;
        if (totalItems === 0) {
            imgPreview.classList.remove('has-image');
            return;
        }
        imgPreview.classList.add('has-image');

        // Image thumbnails
        attachedImages.forEach(function (img, idx) {
            var wrap = document.createElement('div');
            wrap.className = 'h-img-thumb';
            var imgTag = document.createElement('img');
            imgTag.src = img.dataUrl;
            imgTag.alt = 'Image ' + (idx + 1);
            var removeBtn = document.createElement('button');
            removeBtn.className = 'h-img-remove';
            removeBtn.textContent = '✕';
            removeBtn.addEventListener('click', function () {
                attachedImages.splice(idx, 1);
                renderPreviews();
            });
            wrap.appendChild(imgTag);
            wrap.appendChild(removeBtn);
            imgPreview.appendChild(wrap);
        });

        // File chips
        attachedFiles.forEach(function (file, idx) {
            var chip = document.createElement('div');
            chip.className = 'h-file-chip';
            var icon = '📄';
            var nameLower = file.name.toLowerCase();
            if (nameLower.endsWith('.csv')) icon = '📊';
            else if (nameLower.endsWith('.xlsx') || nameLower.endsWith('.xls')) icon = '📗';
            else if (nameLower.endsWith('.json')) icon = '{}';
            chip.innerHTML = '<span class="h-file-icon">' + icon + '</span><span class="h-file-name">' + escapeHtml(file.name) + '</span>';
            var removeBtn = document.createElement('button');
            removeBtn.className = 'h-file-remove';
            removeBtn.textContent = '✕';
            removeBtn.addEventListener('click', function () {
                attachedFiles.splice(idx, 1);
                renderPreviews();
            });
            chip.appendChild(removeBtn);
            imgPreview.appendChild(chip);
        });

        // Counter badge
        var badge = document.createElement('span');
        badge.className = 'h-img-count';
        var parts = [];
        if (attachedImages.length > 0) parts.push(attachedImages.length + ' фото');
        if (attachedFiles.length > 0) parts.push(attachedFiles.length + ' файл');
        badge.textContent = parts.join(', ');
        imgPreview.appendChild(badge);
    }

    function escapeHtml(str) {
        var div = document.createElement('div');
        div.appendChild(document.createTextNode(str));
        return div.innerHTML;
    }

    // ---- Add image from file ----
    function addImageFile(file) {
        if (!file || file.type.indexOf('image/') !== 0) return;
        var reader = new FileReader();
        reader.onload = function (ev) {
            attachedImages.push({
                base64: ev.target.result.split(',')[1],
                type: file.type,
                dataUrl: ev.target.result
            });
            renderPreviews();
        };
        reader.readAsDataURL(file);
    }

    // ---- Read text-based file ----
    function addTextFile(file) {
        var nameLower = file.name.toLowerCase();
        if (nameLower.endsWith('.xlsx') || nameLower.endsWith('.xls')) {
            // Excel: parse with SheetJS
            readExcelFile(file);
            return;
        }
        // Plain text / csv / json / etc
        var reader = new FileReader();
        reader.onload = function (ev) {
            attachedFiles.push({
                name: file.name,
                content: ev.target.result
            });
            renderPreviews();
        };
        reader.readAsText(file);
    }

    // ---- Excel parsing with SheetJS (loaded on-demand) ----
    function readExcelFile(file) {
        loadSheetJS(function () {
            var reader = new FileReader();
            reader.onload = function (ev) {
                try {
                    var data = new Uint8Array(ev.target.result);
                    var workbook = XLSX.read(data, { type: 'array' });
                    var allText = '';
                    workbook.SheetNames.forEach(function (sheetName) {
                        var sheet = workbook.Sheets[sheetName];
                        var csv = XLSX.utils.sheet_to_csv(sheet);
                        allText += '=== Лист: ' + sheetName + ' ===\n' + csv + '\n\n';
                    });
                    attachedFiles.push({
                        name: file.name,
                        content: allText.trim()
                    });
                    renderPreviews();
                } catch (err) {
                    console.error('Excel parse error:', err);
                    statusEl.textContent = '✗ Ошибка чтения Excel';
                }
            };
            reader.readAsArrayBuffer(file);
        });
    }

    var sheetJSLoaded = false;
    function loadSheetJS(callback) {
        if (sheetJSLoaded) { callback(); return; }
        var script = document.createElement('script');
        script.src = 'https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js';
        script.onload = function () {
            sheetJSLoaded = true;
            callback();
        };
        script.onerror = function () {
            statusEl.textContent = '✗ Не удалось загрузить xlsx';
        };
        document.head.appendChild(script);
    }

    // ---- Determine file type ----
    function isImageFile(file) {
        return file.type.indexOf('image/') === 0;
    }

    function isTextLikeFile(file) {
        var nameLower = file.name.toLowerCase();
        var textExts = ['.txt', '.csv', '.json', '.xml', '.md', '.log', '.html', '.css', '.js', '.py', '.java', '.c', '.cpp', '.h', '.sql', '.yaml', '.yml', '.toml', '.ini', '.cfg', '.tsv'];
        var excelExts = ['.xlsx', '.xls'];
        for (var i = 0; i < textExts.length; i++) {
            if (nameLower.endsWith(textExts[i])) return true;
        }
        for (var j = 0; j < excelExts.length; j++) {
            if (nameLower.endsWith(excelExts[j])) return true;
        }
        if (file.type && (file.type.indexOf('text/') === 0 || file.type === 'application/json')) return true;
        return false;
    }

    // ---- Process a dropped/selected file ----
    function processFile(file) {
        if (isImageFile(file)) {
            addImageFile(file);
        } else if (isTextLikeFile(file)) {
            addTextFile(file);
        }
        // else: ignore unsupported
    }

    // ---- Image paste (Ctrl+V) ----
    textarea.addEventListener('paste', function (e) {
        var items = e.clipboardData && e.clipboardData.items;
        if (!items) return;
        for (var i = 0; i < items.length; i++) {
            if (items[i].type.indexOf('image/') === 0) {
                e.preventDefault();
                addImageFile(items[i].getAsFile());
            }
        }
    });

    // ---- Attach button (file picker) ----
    if (attachBtn && fileInput) {
        attachBtn.addEventListener('click', function () {
            fileInput.click();
        });
        fileInput.addEventListener('change', function () {
            var files = fileInput.files;
            for (var i = 0; i < files.length; i++) {
                processFile(files[i]);
            }
            fileInput.value = '';
        });
    }

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
        if (!text && attachedImages.length === 0 && attachedFiles.length === 0) return;

        // UI: loading
        sendBtn.disabled = true;
        copyBtn.classList.remove('ready');
        copyBtn.style.display = 'none';
        loadingEl.classList.add('active');
        statusEl.textContent = '';

        try {
            // Build content array
            const content = [];

            // Add file contents as text context
            if (attachedFiles.length > 0) {
                var fileContext = '';
                for (var f = 0; f < attachedFiles.length; f++) {
                    fileContext += '--- Файл: ' + attachedFiles[f].name + ' ---\n' + attachedFiles[f].content + '\n\n';
                }
                content.push({ type: 'text', text: fileContext.trim() });
            }

            if (text) {
                content.push({ type: 'text', text: text });
            }

            for (var i = 0; i < attachedImages.length; i++) {
                content.push({
                    type: 'image_url',
                    image_url: {
                        url: 'data:' + (attachedImages[i].type || 'image/png') + ';base64,' + attachedImages[i].base64
                    }
                });
            }

            const messages = [
                {
                    role: 'system',
                    content: 'Ты помощник. Отвечай точно, конкретно и по существу на вопросы. Если дано задание — реши его полностью. Если приложены файлы или таблицы — анализируй их содержимое. Ответ давай сразу без лишних пояснений.'
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

            // Show copy button
            copyBtn.classList.add('ready');
            copyBtn.style.display = 'inline-block';
            statusEl.textContent = '✓';

            // Clear input
            textarea.value = '';
            attachedImages = [];
            attachedFiles = [];
            renderPreviews();

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
