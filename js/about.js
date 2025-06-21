document.addEventListener('DOMContentLoaded', function() {
    // 滚动动画效果
    const cards = document.querySelectorAll('.about-card');
    
    // 检测元素是否在视窗内
    function isInViewport(element) {
        const rect = element.getBoundingClientRect();
        return (
            rect.top <= (window.innerHeight || document.documentElement.clientHeight) * 0.85
        );
    }
    
    // 初始检查
    function checkVisibility() {
        cards.forEach(card => {
            if (isInViewport(card)) {
                card.classList.add('visible');
            }
        });
    }
    
    // 滚动监听
    window.addEventListener('scroll', checkVisibility);
    
    // 初始化执行一次
    setTimeout(checkVisibility, 100);
    
    // 确保所有卡片都能在合适的时机显示
    setTimeout(() => {
        cards.forEach(card => card.classList.add('visible'));
    }, 2000);
}); 