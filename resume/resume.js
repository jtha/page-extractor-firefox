// Resume page functionality
document.addEventListener('DOMContentLoaded', function() {
    const refreshBtn = document.getElementById('refresh-btn');
    const editBtn = document.getElementById('edit-btn');
    const updateBtn = document.getElementById('update-btn');
    const cancelBtn = document.getElementById('cancel-btn');
    const resumeContainer = document.getElementById('resume-container');
    
    let currentMarkdown = '';
    let isEditMode = false;
    
    // Load resume on page load
    loadResume();
    
    // Refresh button functionality
    refreshBtn.addEventListener('click', function() {
        loadResume();
    });
    
    // Edit button functionality
    editBtn.addEventListener('click', function() {
        enterEditMode();
    });
    
    // Update button functionality
    updateBtn.addEventListener('click', function() {
        saveResume();
    });
    
    // Cancel button functionality
    cancelBtn.addEventListener('click', function() {
        const textarea = document.getElementById('markdown-editor');
        if (textarea && textarea.value !== currentMarkdown) {
            if (confirm('You have unsaved changes. Are you sure you want to discard them?')) {
                exitEditMode();
            }
        } else {
            exitEditMode();
        }
    });
    
    async function loadResume() {
        try {
            showLoading();
            
            // Fetch master resume from the backend API
            const response = await fetch('http://localhost:8000/master_resume');
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            
            if (data && data.document_markdown) {
                currentMarkdown = data.document_markdown;
                displayResume(data.document_markdown);
            } else {
                showEmpty('No resume found in the system.');
            }
            
        } catch (error) {
            console.error('Error loading resume:', error);
            showError(`Failed to load resume: ${error.message}`);
        }
    }
    
    function enterEditMode() {
        isEditMode = true;
        updateButtonVisibility();
        showEditMode();
    }
    
    function exitEditMode() {
        isEditMode = false;
        updateButtonVisibility();
        displayResume(currentMarkdown);
        // Clear localStorage draft when exiting edit mode
        localStorage.removeItem('resume-draft');
    }
    
    function updateButtonVisibility() {
        if (isEditMode) {
            refreshBtn.style.display = 'none';
            editBtn.style.display = 'none';
            updateBtn.style.display = 'inline-block';
            cancelBtn.style.display = 'inline-block';
        } else {
            refreshBtn.style.display = 'inline-block';
            editBtn.style.display = 'inline-block';
            updateBtn.style.display = 'none';
            cancelBtn.style.display = 'none';
        }
    }
    
    function showEditMode() {
        resumeContainer.innerHTML = `
            <div class="edit-mode" style="display: block;">
                <textarea class="edit-textarea" id="markdown-editor" placeholder="Enter resume markdown here...">${currentMarkdown}</textarea>
                <div id="save-status" class="save-status" style="display: none;"></div>
            </div>
        `;
        
        // Set up auto-save to localStorage while editing
        const textarea = document.getElementById('markdown-editor');
        if (textarea) {
            // Check for existing draft
            const savedDraft = localStorage.getItem('resume-draft');
            if (savedDraft && savedDraft !== currentMarkdown) {
                if (confirm('Found unsaved changes. Would you like to restore them?')) {
                    textarea.value = savedDraft;
                }
            }
            
            // Save to localStorage on input
            textarea.addEventListener('input', function() {
                localStorage.setItem('resume-draft', textarea.value);
                updateUnsavedIndicator(textarea.value !== currentMarkdown);
            });
            
            // Add keyboard shortcut for saving (Ctrl+S or Cmd+S)
            textarea.addEventListener('keydown', function(e) {
                if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                    e.preventDefault();
                    saveResume();
                }
            });
        }
    }
    
    async function saveResume() {
        const textarea = document.getElementById('markdown-editor');
        const saveStatus = document.getElementById('save-status');
        
        if (!textarea) return;
        
        const newMarkdown = textarea.value.trim();
        
        if (!newMarkdown) {
            showSaveStatus('error', 'Resume cannot be empty');
            return;
        }
        
        try {
            // Disable buttons during save
            updateBtn.disabled = true;
            cancelBtn.disabled = true;
            showSaveStatus('saving', 'Saving resume...');
            
            const response = await fetch('http://localhost:8000/document_store/upsert', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    document_id: generateUUID(),
                    document_name: "master_resume",
                    document_markdown: newMarkdown,
                    document_timestamp: Math.floor(Date.now() / 1000),
                })
            });
            
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
            }
            
            // Update current markdown and exit edit mode
            currentMarkdown = newMarkdown;
            showSaveStatus('success', 'Resume saved successfully!');
            
            // Clear localStorage draft after successful save
            localStorage.removeItem('resume-draft');
            
            // Exit edit mode after a brief delay
            setTimeout(() => {
                exitEditMode();
            }, 1500);
            
        } catch (error) {
            console.error('Error saving resume:', error);
            showSaveStatus('error', `Failed to save resume: ${error.message}`);
        } finally {
            // Re-enable buttons
            updateBtn.disabled = false;
            cancelBtn.disabled = false;
        }
    }
    
    function showSaveStatus(type, message) {
        const saveStatus = document.getElementById('save-status');
        if (saveStatus) {
            saveStatus.className = `save-status ${type}`;
            saveStatus.textContent = message;
            saveStatus.style.display = 'block';
        }
    }
    
    function updateUnsavedIndicator(hasUnsavedChanges) {
        if (hasUnsavedChanges) {
            updateBtn.textContent = 'Update *';
            updateBtn.title = 'You have unsaved changes';
        } else {
            updateBtn.textContent = 'Update';
            updateBtn.title = '';
        }
    }
    
    function generateUUID() {
        // Simple UUID v4 generator
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0;
            const v = c == 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }
    
    function showLoading() {
        resumeContainer.innerHTML = '<div class="loading">Loading resume...</div>';
        updateButtonVisibility();
    }
    
    function showError(message) {
        resumeContainer.innerHTML = `<div class="error">Error: ${message}</div>`;
        updateButtonVisibility();
    }
    
    function showEmpty(message) {
        resumeContainer.innerHTML = `<div class="empty">${message}</div>`;
        updateButtonVisibility();
    }
    
    function displayResume(markdownContent) {
        if (isEditMode) return; // Don't update display if in edit mode
        
        // Convert markdown to HTML
        const htmlContent = convertMarkdownToHTML(markdownContent);
        
        // Create resume content container
        const resumeDiv = document.createElement('div');
        resumeDiv.className = 'resume-content';
        resumeDiv.innerHTML = htmlContent;
        
        // Clear container and add resume
        resumeContainer.innerHTML = '';
        resumeContainer.appendChild(resumeDiv);
        
        updateButtonVisibility();
    }
    
    // Simple markdown to HTML converter
    // This handles the most common markdown features needed for a resume
    function convertMarkdownToHTML(markdown) {
        let html = markdown;
        
        // Convert headers (### -> h3, ## -> h2, # -> h1)
        html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
        html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
        html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>');
        
        // Convert horizontal rules first (before other processing)
        html = html.replace(/^---$/gm, '<hr>');
        html = html.replace(/^___$/gm, '<hr>');
        
        // Convert bold text
        html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        html = html.replace(/__(.*?)__/g, '<strong>$1</strong>');
        
        // Convert italic text (after bold to avoid conflicts)
        html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');
        html = html.replace(/_([^_]+)_/g, '<em>$1</em>');
        
        // Convert inline code
        html = html.replace(/`(.*?)`/g, '<code>$1</code>');
        
        // Convert links [text](url)
        html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>');
        
        // Split into lines for list processing
        let lines = html.split('\n');
        let inList = false;
        let listType = null;
        let result = [];
        
        for (let i = 0; i < lines.length; i++) {
            let line = lines[i];
            let trimmedLine = line.trim();
            
            // Check for list items
            let isUnorderedItem = /^[•\-\*]\s+/.test(trimmedLine);
            let isOrderedItem = /^\d+\.\s+/.test(trimmedLine);
            
            if (isUnorderedItem || isOrderedItem) {
                let currentListType = isUnorderedItem ? 'ul' : 'ol';
                
                // Start new list if needed
                if (!inList || listType !== currentListType) {
                    if (inList) {
                        result.push(`</${listType}>`);
                    }
                    result.push(`<${currentListType}>`);
                    inList = true;
                    listType = currentListType;
                }
                
                // Add list item
                let itemText = trimmedLine.replace(/^[•\-\*]\s+/, '').replace(/^\d+\.\s+/, '');
                result.push(`<li>${itemText}</li>`);
            } else {
                // End list if we were in one
                if (inList) {
                    result.push(`</${listType}>`);
                    inList = false;
                    listType = null;
                }
                
                // Add the line
                result.push(line);
            }
        }
        
        // Close any remaining list
        if (inList) {
            result.push(`</${listType}>`);
        }
        
        html = result.join('\n');
        
        // Convert double line breaks to paragraph breaks
        html = html.replace(/\n\s*\n/g, '</p>\n<p>');
        
        // Wrap content in initial paragraph tag
        html = '<p>' + html + '</p>';
        
        // Fix headers and HRs that shouldn't be in paragraphs
        html = html.replace(/<p>(<h[1-6]>.*?<\/h[1-6]>)<\/p>/g, '$1');
        html = html.replace(/<p>(<hr>)<\/p>/g, '$1');
        html = html.replace(/<p>(<\/?[uo]l>)<\/p>/g, '$1');
        
        // Fix empty paragraphs
        html = html.replace(/<p>\s*<\/p>/g, '');
        
        // Handle line breaks within paragraphs
        html = html.replace(/\n(?!<)/g, '<br>');
        
        // Clean up extra spacing
        html = html.replace(/(<br>)+<\/p>/g, '</p>');
        html = html.replace(/<p>(<br>)+/g, '<p>');
        
        return html;
    }
});