// Add this to your main JavaScript file or create a separate file

class ScrollHeader {
    constructor() {
        this.header = document.querySelector('.head');
        this.lastScrollTop = 0;
        this.scrollThreshold = 5; // Minimum scroll distance to trigger hide/show
        this.isScrolling = false;
        
        this.init();
    }
    
    init() {
        if (!this.header) {
            console.warn('Header element with class .head not found');
            return;
        }
        
        // Throttle scroll events for better performance
        window.addEventListener('scroll', () => {
            if (!this.isScrolling) {
                window.requestAnimationFrame(() => {
                    this.handleScroll();
                    this.isScrolling = false;
                });
                this.isScrolling = true;
            }
        });
    }
    
    handleScroll() {
        const currentScrollTop = window.pageYOffset || document.documentElement.scrollTop;
        
        // Don't hide header if we're at the very top
        if (currentScrollTop <= 0) {
            this.showHeader();
            return;
        }
        
        // Calculate scroll direction and distance
        const scrollDifference = Math.abs(currentScrollTop - this.lastScrollTop);
        
        // Only trigger if scroll distance is above threshold
        if (scrollDifference < this.scrollThreshold) {
            return;
        }
        
        if (currentScrollTop > this.lastScrollTop) {
            // Scrolling down - hide header
            this.hideHeader();
        } else {
            // Scrolling up - show header
            this.showHeader();
        }
        
        this.lastScrollTop = currentScrollTop;
    }
    
    hideHeader() {
        this.header.classList.add('header-hidden');
        this.header.classList.remove('header-visible');
    }
    
    showHeader() {
        this.header.classList.add('header-visible');
        this.header.classList.remove('header-hidden');
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new ScrollHeader();
});

// Also initialize if DOM is already loaded
if (document.readyState !== 'loading') {
    new ScrollHeader();
}