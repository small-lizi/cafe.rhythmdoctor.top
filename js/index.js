document.addEventListener('DOMContentLoaded', function() {
    // 全局变量
    const API_URL = 'api/get_chartlist.php';
    let currentPage = 1;
    let currentSearchQuery = '';
    let currentFilters = {
        tags: [],
        authors: [],
        artists: [],
        difficulties: [],
        review: 'peer'
    };
    let lastFacetQuery = '';
    
    // 添加在顶部全局变量后面
    const difficultyLabels = {
        '0': 'Easy',
        '1': 'Medium',
        '2': 'Tough',
        '3': 'Very Tough'
    };
    
    function getDifficultyLabel(value) {
        return difficultyLabels[value] || `难度 ${value}`;
    }
    
    // DOM元素
    const levelsGrid = document.getElementById('levels-grid');
    const pagination = document.getElementById('pagination');
    const searchInput = document.getElementById('search-input');
    const searchButton = document.getElementById('search-button');
    const loadingIndicator = document.getElementById('loading-indicator');
    const applyFiltersBtn = document.getElementById('apply-filters');
    const resetFiltersBtn = document.getElementById('reset-filters');
    const filterSearchInputs = document.querySelectorAll('.filter-search-input');
    
    // 侧边栏控制
    const sidebarToggle = document.getElementById('sidebar-toggle');
    const sidebarContainer = document.getElementById('sidebar-container');
    const sidebarOverlay = document.getElementById('sidebar-overlay');
    const contentWrapper = document.getElementById('content-wrapper');
    
    // HTML转义函数，防止XSS攻击
    function escapeHTML(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }
    
    // URL安全性检查函数
    function isSafeUrl(url) {
        if (!url) return false;
        try {
            const parsedUrl = new URL(url);
            // 只允许http和https协议
            return ['http:', 'https:'].includes(parsedUrl.protocol);
        } catch (e) {
            return false;
        }
    }
    
    // 侧边栏切换功能
    function toggleSidebar() {
        sidebarContainer.classList.toggle('active');
        sidebarOverlay.classList.toggle('active');
        contentWrapper.classList.toggle('sidebar-active');
        
        // 更改按钮图标
        const icon = sidebarToggle.querySelector('i');
        if (sidebarContainer.classList.contains('active')) {
            icon.className = 'fas fa-times'; // 改为关闭图标
        } else {
            icon.className = 'fas fa-filter'; // 恢复为筛选图标
        }
    }
    
    sidebarToggle.addEventListener('click', toggleSidebar);
    sidebarOverlay.addEventListener('click', toggleSidebar);
    
    // 获取谱面数据
    async function fetchLevels(page = 1, query = '', filters = {}, sortBy = '', facetQuery = '') {
        showLoading(true);
        
        try {
            // 构建查询参数
            const params = new URLSearchParams();
            params.append('q', query); // 搜索查询
            params.append('page', page);
            params.append('per_page', 25); // 每页显示25个谱面，与文档默认值保持一致
            
            // 添加必要的基础参数
            params.append('query_by', 'song,authors,artist,tags,description');
            params.append('query_by_weights', '12,8,6,5,4');
            params.append('facet_by', 'authors,tags,source,difficulty,artist');
            params.append('max_facet_values', '10');
            params.append('num_typos', '2,1,1,1,0');
            
            // 添加facet_query参数用于筛选器搜索
            if (facetQuery) {
                params.append('facet_query', facetQuery);
            }
            
            // 添加排序条件
            if (sortBy) {
                params.append('sort_by', sortBy);
            } else {
                // 根据是否为all levels模式设置不同的排序
                if (filters.review === 'all') {
                    // All levels模式使用原网页的排序方式
                    params.append('sort_by', '_text_match:desc,last_updated:desc');
                } else {
                    // Peer-reviewed模式使用默认排序
                    params.append('sort_by', '_text_match:desc,indexed:desc,last_updated:desc');
                }
            }
            
            // 构建筛选条件
            let filterBy = '';
            
            // 根据同行评审选项设置基本过滤条件
            if (!filters.review || filters.review === 'peer') {
                // 只显示同行评审谱面 (approval在10-20之间)
                filterBy = 'approval:=[10..20]';
            } else if (filters.review === 'all') {
                // 显示所有谱面，包括未经评审的
                filterBy = 'approval:=[-1..20]';
            }
            
            // 添加难度筛选
            if (filters.difficulties && filters.difficulties.length > 0) {
                filterBy += ' && difficulty:=[' + filters.difficulties.join(',') + ']';
            }
            
            // 添加标签筛选
            if (filters.tags && filters.tags.length > 0) {
                // 每个标签用反引号包裹
                const tagFilters = filters.tags.map(tag => `\`${tag}\``).join(',');
                filterBy += ` && tags:=[${tagFilters}]`;
            }
            
            // 添加作者筛选
            if (filters.authors && filters.authors.length > 0) {
                // 每个作者用反引号包裹
                const authorFilters = filters.authors.map(author => `\`${author}\``).join(',');
                filterBy += ` && authors:=[${authorFilters}]`;
            }
            
            // 添加艺术家筛选
            if (filters.artists && filters.artists.length > 0) {
                // 每个艺术家用反引号包裹
                const artistFilters = filters.artists.map(artist => `\`${artist}\``).join(',');
                filterBy += ` && artist:=[${artistFilters}]`;
            }
            
            // 添加过滤条件
            params.append('filter_by', filterBy);
            
            // 发送请求到API
            const response = await fetch(`${API_URL}?${params.toString()}`);
            
            if (!response.ok) {
                throw new Error(`API请求失败: ${response.status}`);
            }
            
            const data = await response.json();
            return data;
        } catch (error) {
            console.error('获取谱面数据失败:', error);
            showError('获取谱面数据失败，请稍后再试');
            return null;
        } finally {
            showLoading(false);
        }
    }
    
    // 渲染谱面列表
    function renderLevels(data) {
        if (!data || !data.hits) {
            levelsGrid.innerHTML = '<div class="no-results">没有找到符合条件的谱面</div>';
            pagination.innerHTML = '';
            return;
        }
        
        const levels = data.hits;
        
        if (levels.length === 0) {
            levelsGrid.innerHTML = '<div class="no-results">没有找到符合条件的谱面</div>';
            pagination.innerHTML = '';
            return;
        }
        
        // 清空现有内容
        levelsGrid.innerHTML = '';
        
        // 添加谱面卡片
        levels.forEach((level, index) => {
            const document = level.document;
            
            // 确定难度等级和文本
            let difficultyClass = 'easy';
            let difficultyText = getDifficultyLabel('0'); // 默认值
            
            switch (document.difficulty) {
                case 0:
                    difficultyClass = 'easy';
                    difficultyText = getDifficultyLabel('0'); // Easy
                    break;
                case 1:
                    difficultyClass = 'medium';
                    difficultyText = getDifficultyLabel('1'); // Medium
                    break;
                case 2:
                    difficultyClass = 'tough';
                    difficultyText = getDifficultyLabel('2'); // Tough
                    break;
                case 3:
                    difficultyClass = 'expert';
                    difficultyText = getDifficultyLabel('3'); // Very Tough
                    break;
            }
            
            // 创建标签HTML
            let tagsHTML = '';
            if (document.tags && document.tags.length > 0) {
                // 最多显示4个标签
                const tags = document.tags.slice(0, 4);
                tagsHTML = tags.map(tag => `<span class="card-tag">${escapeHTML(tag)}</span>`).join('');
            } else {
                // 如果没有标签，添加一个占位标签，保持布局一致
                tagsHTML = '<span class="card-tag card-tag-placeholder">无标签</span>';
            }
            
            // 获取作者（可能是字符串或数组）
            let author = Array.isArray(document.authors) ? document.authors[0] : document.authors || "未知作者";
            author = escapeHTML(author);
            
            // 检查图片URL安全性
            const imageUrl = isSafeUrl(document.image) ? document.image : 'https://s1.ax1x.com/2023/06/30/pCRPBA0.png';
            
            // 检查是否有描述
            const hasDescription = document.description && document.description.trim() !== '';
            const description = hasDescription ? escapeHTML(document.description) : '暂无描述';
            
            // 检查是否经过同行评审 (approval >= 10)
            const isPeerReviewed = document.approval >= 10;
            
            // 创建卡片HTML
            const cardHTML = `
                <div class="level-card" style="--card-index: ${index};">
                    <div class="card-image">
                        <img src="${escapeHTML(imageUrl)}" alt="${escapeHTML(document.song)}">
                        <div class="difficulty-badge ${difficultyClass}">${difficultyText}</div>
                    </div>
                    <div class="card-description">${description}</div>
                    <div class="card-content">
                        <h3 class="card-title">${escapeHTML(document.song)}</h3>
                        <p class="card-artist">${escapeHTML(document.artist || '未知艺术家')}</p>
                        <div class="card-meta">
                            <div class="card-author">
                                <i class="fas fa-user"></i> ${author}
                            </div>
                            <div class="card-bpm">
                                ${isPeerReviewed ? '<div class="peer-reviewed-badge"><i class="fas fa-check"></i></div>' : ''}
                                <i class="fas fa-heartbeat"></i> ${escapeHTML(String(document.min_bpm || '?'))} BPM
                            </div>
                        </div>
                        <div class="card-tags">
                            ${tagsHTML}
                        </div>
                        <div class="card-actions">
                            ${getDownloadButtons(document)}
                        </div>
                    </div>
                </div>
            `;
            
            levelsGrid.innerHTML += cardHTML;
        });
        
        // 渲染分页 - 传递从API返回的数据中获取的参数
        const perPage = data.request_params.per_page || 25; // 使用API返回的每页数量或默认值
        renderPagination(data.found, data.page, perPage);
        
        // 如果有facet_counts，更新筛选选项
        if (data.facet_counts && !lastFacetQuery) {
            updateFilterOptions(data.facet_counts);
        }
    }
    
    // 更新筛选选项
    function updateFilterOptions(facetCounts) {
        // 遍历所有筛选组
        facetCounts.forEach(facet => {
            let filterListId;
            
            switch (facet.field_name) {
                case 'tags':
                    filterListId = 'tag-filters';
                    break;
                case 'authors':
                    filterListId = 'author-filters';
                    break;
                case 'artist':
                    filterListId = 'artist-filters';
                    break;
                case 'difficulty':
                    filterListId = 'difficulty-filters';
                    break;
                default:
                    return; // 跳过不需要处理的筛选类型
            }
            
            const filterList = document.getElementById(filterListId);
            if (!filterList) return;
            
            // 清空现有选项
            filterList.innerHTML = '';
            
            // 获取总数
            const totalValues = facet.stats.total_values || 0;
            
            // 更新标题中的总数
            const filterGroup = filterList.closest('.filter-group');
            const totalCountSpan = filterGroup.querySelector('.total-count');
            if (totalCountSpan) {
                totalCountSpan.textContent = `(${totalValues})`;
            }
            
            // 添加新选项
            facet.counts.forEach(item => {
                const value = item.value;
                const count = item.count;
                
                // 处理高亮显示的内容，移除HTML标签和多余空格
                let displayText = item.highlighted || value;
                // 如果包含<mark>标签，则去除HTML标签但保留内容
                if (displayText.includes('<mark>')) {
                    displayText = displayText.replace(/<\/?mark>/g, '');
                }
                // 去除两端空格
                displayText = displayText.trim();
                
                // 创建唯一的ID
                const idSuffix = value.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
                const idPrefix = facet.field_name === 'tags' ? 'tag' : 
                                 facet.field_name === 'authors' ? 'author' : 
                                 facet.field_name === 'artist' ? 'artist' : 'diff';
                const id = `${idPrefix}-${idSuffix}`;
                
                // 创建安全的HTML
                const safeValue = escapeHTML(value);
                let safeDisplayText = escapeHTML(displayText);
                // 特殊处理难度值
                if (facet.field_name === 'difficulty') {
                    safeDisplayText = getDifficultyLabel(value);
                }
                
                const html = `
                    <li class="filter-item">
                        <input type="checkbox" id="${escapeHTML(id)}" class="filter-checkbox" data-filter="${
                            facet.field_name === 'tags' ? 'tag' : 
                            facet.field_name === 'authors' ? 'author' : 
                            facet.field_name === 'artist' ? 'artist' : 'difficulty'
                        }" value="${safeValue}">
                        <label for="${escapeHTML(id)}" class="filter-label">${safeDisplayText} <span class="filter-count">${count}</span></label>
                    </li>
                `;
                
                filterList.innerHTML += html;
            });
        });
    }
    
    // 生成下载按钮HTML
    function getDownloadButtons(document) {
        let buttonsHTML = '';
        
        // 检查备用下载链接 (现在作为主下载链接使用)
        if (document.url2 && document.url2 !== "undefined" && document.url2 !== "null") {
            // 验证URL安全性
            if (isSafeUrl(document.url2)) {
                // 使用中转下载链接
                const downloadUrl = `api/download.php?url=${encodeURIComponent(document.url2)}`;
                buttonsHTML += `
                    <a href="${escapeHTML(downloadUrl)}" class="download-button primary-download" target="_blank" rel="noopener noreferrer">
                        <i class="fas fa-download"></i> 下载谱面
                    </a>
                `;
            }
        }
        
        // 检查主下载链接 (现在作为备用下载链接使用)
        if (document.url && document.url !== "undefined" && document.url !== "null") {
            // 验证URL安全性
            if (isSafeUrl(document.url)) {
                // 使用中转下载链接
                const downloadUrl = `api/download.php?url=${encodeURIComponent(document.url)}`;
                if (buttonsHTML) {
                    // 如果已有主链接，添加备用链接按钮样式
                    buttonsHTML += `
                        <a href="${escapeHTML(downloadUrl)}" class="download-button secondary-download" target="_blank" rel="noopener noreferrer">
                            <i class="fas fa-download"></i> 备用下载
                        </a>
                    `;
                } else {
                    // 如果没有主链接，使用原主链接作为主按钮
                    buttonsHTML += `
                        <a href="${escapeHTML(downloadUrl)}" class="download-button primary-download" target="_blank" rel="noopener noreferrer">
                            <i class="fas fa-download"></i> 下载谱面
                        </a>
                    `;
                }
            }
        }
        
        // 如果没有任何可用链接
        if (!buttonsHTML) {
            buttonsHTML = `
                <span class="download-button disabled">
                    <i class="fas fa-exclamation-circle"></i> 暂无下载链接
                </span>
            `;
        }
        
        return buttonsHTML;
    }
    
    // 渲染分页
    function renderPagination(totalResults, currentPage, perPage) {
        // 确保参数都是数字类型
        totalResults = Number(totalResults) || 0;
        currentPage = Number(currentPage) || 1;
        perPage = Number(perPage) || 25; // 默认每页25个
        
        const totalPages = Math.ceil(totalResults / perPage);
        
        if (totalPages <= 1) {
            pagination.innerHTML = '';
            return;
        }
        
        let paginationHTML = '';
        
        // 显示当前页码和总数
        paginationHTML += `<div class="page-info">第 ${escapeHTML(String(currentPage))} 页 / 共 ${escapeHTML(String(totalPages))} 页</div>`;
        
        // 上一页按钮
        if (currentPage > 1) {
            paginationHTML += `<a href="#" class="page-link prev-page"><i class="fas fa-chevron-left"></i></a>`;
        } else {
            paginationHTML += `<a href="#" class="page-link disabled"><i class="fas fa-chevron-left"></i></a>`;
        }
        
        // 页码按钮
        const maxVisiblePages = window.innerWidth < 768 ? 3 : 5;
        let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
        let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
        
        if (endPage - startPage + 1 < maxVisiblePages) {
            startPage = Math.max(1, endPage - maxVisiblePages + 1);
        }
        
        // 第一页
        if (startPage > 1) {
            paginationHTML += `<a href="#" class="page-link" data-page="1">1</a>`;
            if (startPage > 2) {
                paginationHTML += `<a href="#" class="page-link disabled"><i class="fas fa-ellipsis-h"></i></a>`;
            }
        }
        
        // 页码
        for (let i = startPage; i <= endPage; i++) {
            paginationHTML += `<a href="#" class="page-link ${i === parseInt(currentPage) ? 'active' : ''}" data-page="${i}">${i}</a>`;
        }
        
        // 最后一页
        if (endPage < totalPages) {
            if (endPage < totalPages - 1) {
                paginationHTML += `<a href="#" class="page-link disabled"><i class="fas fa-ellipsis-h"></i></a>`;
            }
            paginationHTML += `<a href="#" class="page-link" data-page="${totalPages}">${totalPages}</a>`;
        }
        
        // 下一页按钮
        if (currentPage < totalPages) {
            paginationHTML += `<a href="#" class="page-link next-page"><i class="fas fa-chevron-right"></i></a>`;
        } else {
            paginationHTML += `<a href="#" class="page-link disabled"><i class="fas fa-chevron-right"></i></a>`;
        }
        
        pagination.innerHTML = paginationHTML;
        
        // 添加分页点击事件
        const pageLinks = pagination.querySelectorAll('.page-link:not(.disabled)');
        pageLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                
                let targetPage = currentPage;
                
                if (link.classList.contains('prev-page')) {
                    targetPage = parseInt(currentPage) - 1;
                } else if (link.classList.contains('next-page')) {
                    targetPage = parseInt(currentPage) + 1;
                } else if (link.hasAttribute('data-page')) {
                    targetPage = parseInt(link.getAttribute('data-page'));
                }
                
                if (targetPage !== parseInt(currentPage)) {
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                    loadLevels(targetPage, currentSearchQuery, currentFilters);
                }
            });
        });

        // 控制分页器的显示与隐藏
        let lastScrollTop = 0;
        const hideTimeout = 3000; // 3秒后自动隐藏
        let hideTimer;
        
        function showPagination() {
            pagination.style.opacity = '1';
            pagination.style.transform = 'translateY(0)';
            clearTimeout(hideTimer);
            hideTimer = setTimeout(() => {
                pagination.style.opacity = '0.5';
            }, hideTimeout);
        }
        
        window.addEventListener('scroll', () => {
            const st = window.pageYOffset || document.documentElement.scrollTop;
            if (st > lastScrollTop) {
                // 向下滚动时，显示分页器
                showPagination();
            } else {
                // 向上滚动时，显示分页器
                showPagination();
            }
            lastScrollTop = st <= 0 ? 0 : st;
        });
        
        // 初始显示
        showPagination();
    }
    
    // 显示/隐藏加载指示器
    function showLoading(show) {
        if (show) {
            loadingIndicator.style.display = 'flex';
        } else {
            loadingIndicator.style.display = 'none';
        }
    }
    
    // 显示错误信息
    function showError(message) {
        levelsGrid.innerHTML = `<div class="error-message">${escapeHTML(message)}</div>`;
    }
    
    // 加载谱面
    async function loadLevels(page = 1, query = '', filters = {}, sortBy = '', facetQuery = '') {
        // 更新当前页码
        currentPage = page;
        lastFacetQuery = facetQuery;
        
        const data = await fetchLevels(page, query, filters, sortBy, facetQuery);
        if (data) {
            renderLevels(data);
            
            // 如果是facet查询，并且有返回结果，更新对应的筛选器列表
            if (facetQuery && data.facet_counts) {
                // 找出facet_query针对的是哪个字段
                const field = facetQuery.split(':')[0];
                const fieldFacet = data.facet_counts.find(f => f.field_name === field);
                
                if (fieldFacet) {
                    const facetUpdate = [];
                    facetUpdate.push(fieldFacet);
                    updateFilterOptions(facetUpdate);
                }
            }
        }
    }
    
    // 搜索功能
    searchButton.addEventListener('click', () => {
        const query = searchInput.value.trim();
        currentSearchQuery = query;
        currentPage = 1;
        loadLevels(currentPage, currentSearchQuery, currentFilters);
    });
    
    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            const query = searchInput.value.trim();
            currentSearchQuery = query;
            currentPage = 1;
            loadLevels(currentPage, currentSearchQuery, currentFilters);
        }
    });
    
    // 初始化筛选搜索框
    filterSearchInputs.forEach(input => {
        input.addEventListener('input', function() {
            const searchValue = this.value.toLowerCase();
            
            // 如果搜索内容为空，还原筛选项列表
            if (!searchValue) {
                const filterGroup = this.closest('.filter-group');
                const filterList = filterGroup.querySelector('.filter-list');
                const filterItems = filterList.querySelectorAll('.filter-item');
                
                filterItems.forEach(item => {
                    item.style.display = '';
                });
            }
            // 如果搜索内容不为空，发送facet_query请求
            else {
                // 确定是哪种筛选器
                const filterGroup = this.closest('.filter-group');
                const filterTitle = filterGroup.querySelector('.filter-title').textContent;
                
                let facetField;
                if (filterTitle.includes('标签')) {
                    facetField = 'tags';
                } else if (filterTitle.includes('作者')) {
                    facetField = 'authors';
                } else if (filterTitle.includes('艺术家')) {
                    facetField = 'artist';
                } else {
                    // 对于难度等其他不需要facet查询的筛选器，使用本地筛选
                    const filterList = filterGroup.querySelector('.filter-list');
                    const filterItems = filterList.querySelectorAll('.filter-item');
                    
                    filterItems.forEach(item => {
                        const label = item.querySelector('.filter-label').textContent.toLowerCase();
                        if (label.includes(searchValue)) {
                            item.style.display = '';
                        } else {
                            item.style.display = 'none';
                        }
                    });
                    return;
                }
                
                // 发送facet_query请求
                const facetQuery = `${facetField}:${searchValue}`;
                loadLevels(1, currentSearchQuery, currentFilters, '', facetQuery);
            }
        });
    });
    
    // 筛选功能
    applyFiltersBtn.addEventListener('click', () => {
        // 收集所有选中的筛选条件
        const tagCheckboxes = document.querySelectorAll('[data-filter="tag"]:checked');
        const authorCheckboxes = document.querySelectorAll('[data-filter="author"]:checked');
        const artistCheckboxes = document.querySelectorAll('[data-filter="artist"]:checked');
        const difficultyCheckboxes = document.querySelectorAll('[data-filter="difficulty"]:checked');
        
        // 获取同行评审设置
        const reviewPeer = document.getElementById('review-peer');
        const reviewAll = document.getElementById('review-all');
        let reviewSetting = 'peer'; // 默认值
        
        if (reviewAll && reviewAll.checked) {
            reviewSetting = 'all';
        }
        
        currentFilters = {
            tags: Array.from(tagCheckboxes).map(cb => cb.value),
            authors: Array.from(authorCheckboxes).map(cb => cb.value),
            artists: Array.from(artistCheckboxes).map(cb => cb.value),
            difficulties: Array.from(difficultyCheckboxes).map(cb => cb.value),
            review: reviewSetting
        };
        
        currentPage = 1;
        loadLevels(currentPage, currentSearchQuery, currentFilters);
        
        // 关闭侧边栏
        if (sidebarContainer.classList.contains('active')) {
            toggleSidebar();
        }
    });
    
    // 重置筛选按钮
    resetFiltersBtn.addEventListener('click', () => {
        // 重置所有筛选条件
        const allCheckboxes = document.querySelectorAll('.filter-checkbox:not([name="review"])');
        allCheckboxes.forEach(cb => {
            if (cb.type !== 'radio') {
                cb.checked = false;
            }
        });
        
        // 重置同行评审设置为默认值
        const reviewPeer = document.getElementById('review-peer');
        if (reviewPeer) {
            reviewPeer.checked = true;
        }
        
        // 清空筛选搜索框
        filterSearchInputs.forEach(input => {
            input.value = '';
            // 恢复显示所有筛选项
            const filterList = input.closest('.filter-group').querySelector('.filter-list');
            const filterItems = filterList.querySelectorAll('.filter-item');
            filterItems.forEach(item => {
                item.style.display = '';
            });
        });
        
        currentFilters = {
            tags: [],
            authors: [],
            artists: [],
            difficulties: [],
            review: 'peer'
        };
        
        currentPage = 1;
        currentSearchQuery = ''; // 重置搜索查询
        searchInput.value = ''; // 清空搜索框
        loadLevels(currentPage, currentSearchQuery, currentFilters);
    });
    
    // 初始加载
    loadLevels();
});