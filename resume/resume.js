// Resume page functionality
document.addEventListener('DOMContentLoaded', function() {
    const refreshBtn = document.getElementById('refresh-btn');
    const resumeContainer = document.getElementById('resume-container');
    
    // Load resume on page load
    loadResume();
    
    // Refresh button functionality
    refreshBtn.addEventListener('click', function() {
        loadResume();
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
                displayResume(data.document_markdown);
            } else {
                showEmpty('No resume found in the system.');
            }
            
        } catch (error) {
            console.error('Error loading resume:', error);
            showError(`Failed to load resume: ${error.message}`);
        }
    }
    
    function showLoading() {
        resumeContainer.innerHTML = '<div class="loading">Loading resume...</div>';
    }
    
    function showError(message) {
        resumeContainer.innerHTML = `<div class="error">Error: ${message}</div>`;
    }
    
    function showEmpty(message) {
        resumeContainer.innerHTML = `<div class="empty">${message}</div>`;
    }
    
    function displayResume(markdownContent) {
        // Convert markdown to HTML
        const htmlContent = convertMarkdownToHTML(markdownContent);
        
        // Create resume content container
        const resumeDiv = document.createElement('div');
        resumeDiv.className = 'resume-content';
        resumeDiv.innerHTML = htmlContent;
        
        // Clear container and add resume
        resumeContainer.innerHTML = '';
        resumeContainer.appendChild(resumeDiv);
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