// Opening slide sequence: image-1 -> image-2 -> video (with ping-pong behavior preserved)
(() => {
    const slide = document.getElementById('slide-2-opening');
    if (!slide) return;
    const img1 = document.getElementById('opening-image-1');
    const img2 = document.getElementById('opening-image-2');
    const video = document.getElementById('opening-video');
    if (!img1 || !img2 || !video) return;

    let step = 0; // 0: showing img1, 1: reveal img2, 2: reveal video

    const reveal = (el) => {
        el.classList.remove('hidden');
        el.classList.add('revealed');
    };

    // Reset on slide activation to initial state
    const resetSequence = () => {
        step = 0;
        img1.classList.remove('hidden');
        img1.classList.add('revealed');
        img2.classList.add('hidden');
        img2.classList.remove('revealed');
        video.classList.add('hidden');
        video.classList.remove('revealed');
        try { video.pause(); video.currentTime = 0; } catch (e) {}
    };

    // Ensure initial states
    img1.classList.add('revealed');
    img2.classList.add('hidden');
    video.classList.add('hidden');

    // Click anywhere in the grid to advance
    const grid = slide.querySelector('.grid.two');
    if (grid) {
        grid.style.cursor = 'pointer';
        grid.addEventListener('click', () => {
            if (step === 0) {
                reveal(img2);
                step = 1;
            } else if (step === 1) {
                reveal(video);
                step = 2;
                try { video.play(); } catch (e) {}
            } else {
                // Optional: loop back to start on extra clicks
                resetSequence();
            }
        });
    }

    // Ping-pong playback for the video if data-pingpong present
    if (video.hasAttribute('data-pingpong')) {
        let reversing = false;
        let rafId = null;
        const endMargin = 0.15; // seconds to avoid encoder black frames

        const onTimeUpdate = () => {
            if (!reversing && video.duration && video.currentTime > (video.duration - endMargin)) {
                reversing = true;
                if (rafId) cancelAnimationFrame(rafId);
                stepBack();
            }
        };

        const stepBack = () => {
            if (!reversing) return;
            video.pause();
            const back = () => {
                if (video.currentTime <= endMargin) {
                    reversing = false;
                    video.play().catch(()=>{});
                    return;
                }
                try { video.currentTime = Math.max(0, video.currentTime - 0.033); } catch (e) {}
                rafId = requestAnimationFrame(back);
            };
            rafId = requestAnimationFrame(back);
        };

        video.addEventListener('timeupdate', onTimeUpdate);

        // Clean up on slide change using a MutationObserver on active class
        const obs = new MutationObserver(() => {
            const isActive = slide.classList.contains('active');
            if (isActive) {
                resetSequence();
            } else {
                if (rafId) cancelAnimationFrame(rafId);
                video.removeEventListener('timeupdate', onTimeUpdate);
            }
        });
        obs.observe(slide, { attributes: true, attributeFilter: ['class'] });
    }
})();
// Slides and navigation
let currentSlide = 0;
const allSlides = document.querySelectorAll('.slide');
const slides = Array.from(allSlides).filter((s) => !s.hasAttribute('data-hidden'));
function showSlide(index) {
    const target = slides[index];
    allSlides.forEach((slide) => slide.classList.toggle('active', slide === target));
    currentSlide = index;
}
function nextSlide() { currentSlide = (currentSlide + 1) % slides.length; showSlide(currentSlide); }
function prevSlide() { currentSlide = (currentSlide - 1 + slides.length) % slides.length; showSlide(currentSlide); }
function goToSlide(index) { if (index >= 0 && index < slides.length) showSlide(index); }
document.addEventListener('keydown', (e) => { if (e.key === 'ArrowRight') nextSlide(); if (e.key === 'ArrowLeft') prevSlide(); });

// Ensure we start on the first non-hidden slide (or preserve an active non-hidden slide)
document.addEventListener('DOMContentLoaded', () => {
    const activeEl = Array.from(allSlides).find(s => s.classList.contains('active'));
    const idx = activeEl ? slides.indexOf(activeEl) : -1;
    showSlide(idx >= 0 ? idx : 0);
});

// AI for Businesses course helpers: prompt launchers, section timers, and timeline sorting
document.addEventListener('DOMContentLoaded', () => {
    // Prompt buttons: either open a direct URL or ChatGPT with prefilled prompt text
    const promptButtons = document.querySelectorAll('.prompt-btn');
    promptButtons.forEach((btn) => {
        btn.addEventListener('click', () => {
            const directUrl = btn.getAttribute('data-url');
            if (directUrl) {
                window.open(directUrl, '_blank', 'noopener,noreferrer');
                return;
            }

            const prompt = btn.getAttribute('data-prompt');
            if (!prompt) return;

            const encoded = encodeURIComponent(prompt);
            const chatGptUrl = `https://chatgpt.com/?q=${encoded}`;
            window.open(chatGptUrl, '_blank', 'noopener,noreferrer');
        });
    });

    // Section timers
    const timers = document.querySelectorAll('.session-timer');
    timers.forEach((timerEl) => {
        let intervalId = null;
        let remaining = Math.max(1, parseInt(timerEl.dataset.minutes || '5', 10)) * 60;

        const initialSeconds = remaining;
        const originalText = timerEl.textContent;

        function formatClock(totalSeconds) {
            const minutes = Math.floor(totalSeconds / 60);
            const seconds = totalSeconds % 60;
            return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
        }

        function resetTimer() {
            if (intervalId) {
                clearInterval(intervalId);
                intervalId = null;
            }
            remaining = initialSeconds;
            timerEl.textContent = originalText;
            timerEl.classList.remove('running', 'finished');
            timerEl.setAttribute('aria-label', `${initialSeconds / 60} minute timer. Click to start.`);
        }

        timerEl.addEventListener('click', () => {
            if (intervalId) {
                resetTimer();
                return;
            }

            timerEl.classList.add('running');
            timerEl.classList.remove('finished');
            timerEl.textContent = `Time left: ${formatClock(remaining)} (click to reset)`;

            intervalId = setInterval(() => {
                remaining -= 1;
                if (remaining <= 0) {
                    clearInterval(intervalId);
                    intervalId = null;
                    timerEl.classList.remove('running');
                    timerEl.classList.add('finished');
                    timerEl.textContent = 'Section complete';
                    return;
                }
                timerEl.textContent = `Time left: ${formatClock(remaining)} (click to reset)`;
            }, 1000);
        });
    });

    // Timeline drag-and-drop sorting activity
    const timelineCardsContainer = document.getElementById('timeline-cards');
    const timelineSlotsContainer = document.getElementById('timeline-slots');
    const checkBtn = document.getElementById('timeline-check');
    const resetBtn = document.getElementById('timeline-reset');
    const feedback = document.getElementById('timeline-feedback');

    if (!timelineCardsContainer || !timelineSlotsContainer || !checkBtn || !resetBtn || !feedback) return;

    const correctOrder = [
        '1956',
        '1997',
        '2012',
        '2017',
        '2020',
        '2022',
        '2024',
    ];

    let draggedCard = null;

    function attachCardEvents(card) {
        card.addEventListener('dragstart', () => {
            draggedCard = card;
            card.classList.add('dragging');
        });
        card.addEventListener('dragend', () => {
            card.classList.remove('dragging');
            draggedCard = null;
        });
    }

    timelineCardsContainer.querySelectorAll('.timeline-card').forEach(attachCardEvents);

    function allowDrop(zone) {
        zone.addEventListener('dragover', (e) => {
            e.preventDefault();
            zone.classList.add('drag-over');
        });
        zone.addEventListener('dragleave', () => {
            zone.classList.remove('drag-over');
        });
        zone.addEventListener('drop', (e) => {
            e.preventDefault();
            zone.classList.remove('drag-over');
            if (!draggedCard) return;

            const existing = zone.querySelector('.timeline-card');
            if (existing) {
                timelineCardsContainer.appendChild(existing);
            }
            zone.appendChild(draggedCard);
            feedback.textContent = '';
        });
    }

    allowDrop(timelineCardsContainer);
    timelineSlotsContainer.querySelectorAll('.timeline-slot').forEach(allowDrop);

    checkBtn.addEventListener('click', () => {
        const slotCards = Array.from(timelineSlotsContainer.querySelectorAll('.timeline-slot'))
            .map((slot) => slot.querySelector('.timeline-card'));

        if (slotCards.some((card) => !card)) {
            feedback.textContent = 'Place all timeline cards before checking.';
            feedback.classList.remove('timeline-success');
            feedback.classList.add('timeline-warning');
            return;
        }

        const answers = slotCards.map((card) => card.dataset.event);
        const correctCount = answers.filter((value, idx) => value === correctOrder[idx]).length;

        if (correctCount === correctOrder.length) {
            feedback.textContent = 'Perfect order. Great work.';
            feedback.classList.remove('timeline-warning');
            feedback.classList.add('timeline-success');
        } else {
            feedback.textContent = `You have ${correctCount}/${correctOrder.length} in the correct position. Adjust and try again.`;
            feedback.classList.remove('timeline-success');
            feedback.classList.add('timeline-warning');
        }
    });

    resetBtn.addEventListener('click', () => {
        const cards = Array.from(timelineSlotsContainer.querySelectorAll('.timeline-card'));
        cards.forEach((card) => timelineCardsContainer.appendChild(card));
        feedback.textContent = '';
        feedback.classList.remove('timeline-success', 'timeline-warning');
    });
});

// Intro video: fade-out before loop, then restart with fade-in
let videoLoopActive = true;
const introVideo = document.getElementById('intro-video');
if (introVideo) {
    const fadeDurationMs = 900; // matches CSS transition ~1.2s but slightly shorter for snappier feel
    const preEndBuffer = 0.8;   // seconds before the end to start fading
    let fading = false;

    function restartWithFade() {
        introVideo.pause();
        introVideo.classList.add('fade-out');
        setTimeout(() => {
            introVideo.currentTime = 0;
            introVideo.classList.remove('fade-out');
            // ensure visibility for next loop
            introVideo.classList.add('fade-in');
            introVideo.play().catch(() => {});
            setTimeout(() => introVideo.classList.remove('fade-in'), fadeDurationMs);
            fading = false;
        }, fadeDurationMs);
    }

    introVideo.addEventListener('timeupdate', () => {
        if (!videoLoopActive || fading || !Number.isFinite(introVideo.duration)) return;
        const timeLeft = introVideo.duration - introVideo.currentTime;
        if (timeLeft <= preEndBuffer) {
            fading = true;
            restartWithFade();
        }
    });

    introVideo.addEventListener('ended', () => {
        // Fallback in case timeupdate didn't fire near the end
        if (!videoLoopActive || fading) return;
        fading = true;
        restartWithFade();
    });
}
const nextBtn = document.querySelector('.nav button[onclick*="nextSlide"]');
if (nextBtn) { nextBtn.addEventListener('click', () => { videoLoopActive = false; if (introVideo) introVideo.pause(); }); }

// Nav reveal near bottom
const nav = document.querySelector('.nav');
let navVisible = false; let navTimeout; let inActivationZone = false;
function showNav() { if (!navVisible) { nav.classList.add('visible'); navVisible = true; } clearTimeout(navTimeout); }
function hideNavWithDelay() { clearTimeout(navTimeout); navTimeout = setTimeout(() => { if (!nav.matches(':hover') && !inActivationZone) { nav.classList.remove('visible'); navVisible = false; } }, 2000); }
document.addEventListener('mousemove', (e) => {
    const navRect = nav.getBoundingClientRect();
    const inZone = e.clientY > window.innerHeight - 120;
    const overNav = (e.clientX >= navRect.left && e.clientX <= navRect.right && e.clientY >= navRect.top && e.clientY <= navRect.bottom);
    if (inZone) { if (!inActivationZone) { showNav(); } inActivationZone = true; }
    else { inActivationZone = false; if (!overNav) { hideNavWithDelay(); } }
});
nav.addEventListener('mouseenter', () => { clearTimeout(navTimeout); nav.classList.add('visible'); navVisible = true; });
nav.addEventListener('mouseleave', () => { if (!inActivationZone) { hideNavWithDelay(); } });

// Timer helpers (generic; supports multiple instances)
function polarToCartesian(cx, cy, r, angle) {
    const a = (angle - 90) * Math.PI / 180.0;
    return { x: cx + (r * Math.cos(a)), y: cy + (r * Math.sin(a)) };
}
function describeSector(cx, cy, r, startAngle, endAngle) {
    const start = polarToCartesian(cx, cy, r, endAngle);
    const end = polarToCartesian(cx, cy, r, startAngle);
    const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";
    return ["M", cx, cy, "L", start.x, start.y, "A", r, r, 0, largeArcFlag, 0, end.x, end.y, "Z"].join(" ");
}
function formatTime(totalSeconds) {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}
function setTimerDuration(btn, seconds) {
    const container = btn.closest('.activity-section');
    const label = container.querySelector('.timer');
    label.dataset.duration = seconds;
    label.textContent = `Click to Start Q&A Timer: ${formatTime(seconds)}`;
}
function startTimerGeneric(element) {
    const container = element.closest('.activity-section');
    const svgCircle = container.querySelector('.timer-progress');
    const svgSector = container.querySelector('.timer-sector');
    const totalLength = 2 * Math.PI * 35; // Circumference
    let time = parseInt(element.dataset.duration || '300', 10);
    const total = time;
    element.onclick = null;
    svgCircle.style.strokeDasharray = totalLength;
    svgCircle.style.strokeDashoffset = 0;
    function updateSector(elapsedSeconds, totalSeconds) {
        const percent = Math.min(1, Math.max(0, elapsedSeconds / totalSeconds));
        const endAngle = 360 * percent;
        svgSector.setAttribute('d', describeSector(40, 40, 32, 0, endAngle));
    }
    // Initial paint
    updateSector(0, total);
    element.textContent = formatTime(time);
    const timerInterval = setInterval(() => {
        time--;
        const remaining = Math.max(0, time);
        const elapsed = total - remaining;
        element.textContent = remaining > 0 ? formatTime(remaining) : "0:00";
        svgCircle.style.strokeDashoffset = (elapsed / total) * totalLength;
        updateSector(elapsed, total);
        if (remaining <= 0) {
            clearInterval(timerInterval);
            element.textContent = "Time's Up!";
            svgCircle.style.strokeDashoffset = totalLength;
            updateSector(total, total);
        }
    }, 1000);
}

// Conversation spark: reveal callouts on subsequent image clicks
document.addEventListener('DOMContentLoaded', () => {
    // Initialize currentSlide by finding the active slide, in case the first is not active
    const initialIndex = Array.from(slides).findIndex(s => s.classList.contains('active'));
    if (initialIndex >= 0) currentSlide = initialIndex;
    // Ensure consistent active state
    showSlide(currentSlide);

    const conversationSlide = document.getElementById('slide-3-conversation');
    if (!conversationSlide) return;
    const stage = conversationSlide.querySelector('.callout-stage');
    const hero = stage ? stage.querySelector('.story-hero') : null;
    const calloutProblem = stage ? stage.querySelector('.callout-problem') : null;
    const calloutSolution = stage ? stage.querySelector('.callout-solution') : null;
    if (!hero || !calloutProblem || !calloutSolution) return;

    let clickStep = 0;
    function resetCallouts() {
        clickStep = 0;
        calloutProblem.classList.remove('animate-problem');
        calloutSolution.classList.remove('animate-solution');
        // Reset inline animation style by forcing reflow if needed
        // eslint-disable-next-line no-unused-expressions
        void calloutProblem.offsetWidth; void calloutSolution.offsetWidth;
    }

    // Reset whenever the slide becomes active
    const observer = new MutationObserver(() => {
        if (conversationSlide.classList.contains('active')) {
            resetCallouts();
        }
    });
    observer.observe(conversationSlide, { attributes: true, attributeFilter: ['class'] });

    hero.addEventListener('click', () => {
        if (clickStep === 0) {
            calloutProblem.classList.add('animate-problem');
            clickStep = 1;
        } else if (clickStep === 1) {
            calloutSolution.classList.add('animate-solution');
            clickStep = 2;
        } else {
            // Optional: restart sequence on third click
            resetCallouts();
        }
    });
});

// Slide 7: Open localhost app in modal on image click
document.addEventListener('DOMContentLoaded', () => {
    const slideIntro = document.getElementById('slide-7-intro');
    const modal = document.getElementById('tt-modal');
    const modalContent = modal ? modal.querySelector('.modal-content') : null;
    const closeBtn = modal ? modal.querySelector('.modal-close') : null;
    const iframe = modal ? modal.querySelector('#tt-modal-frame') : null;
    if (!slideIntro || !modal || !modalContent || !closeBtn || !iframe) return;

    const triggerImg = slideIntro.querySelector('img.story-hero');
    if (!triggerImg) return;

    function openModal() {
        // set src just-in-time to avoid background loading
        iframe.src = 'http://localhost:3000/';
        modal.classList.add('show');
        modal.setAttribute('aria-hidden', 'false');
        // focus the close button for accessibility
        setTimeout(() => closeBtn.focus(), 0);
        // temporarily disable slide keyboard nav while modal is open
        document.addEventListener('keydown', trapKeys, true);
    }

    function closeModal() {
        modal.classList.remove('show');
        modal.setAttribute('aria-hidden', 'true');
        // clear src to stop any audio/network when closed
        iframe.src = 'about:blank';
        document.removeEventListener('keydown', trapKeys, true);
    }

    function trapKeys(e) {
        if (e.key === 'Escape') { e.preventDefault(); closeModal(); return; }
        // Prevent arrow keys from navigating slides while modal is open
        if (['ArrowLeft','ArrowRight','PageUp','PageDown','Home','End'].includes(e.key)) {
            e.stopPropagation();
            e.preventDefault();
        }
    }

    triggerImg.addEventListener('click', openModal);
    closeBtn.addEventListener('click', closeModal);
    // Click on backdrop closes; but ignore clicks inside content
    modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });
});

// Co-Design: click to reveal emoji rows under each card
document.addEventListener('DOMContentLoaded', () => {
    const coDesign = document.getElementById('slide-5-codesign');
    if (!coDesign) return;
    const secondCard = coDesign.querySelector('[data-seq="second"]');
    let revealedSecond = false;

    function resetCoDesign() {
        revealedSecond = false;
        if (secondCard) secondCard.classList.add('seq-hidden');
        coDesign.querySelectorAll('.emoji-row.visible').forEach(el => el.classList.remove('visible'));
    }

    // Reset when slide becomes active
    const cdObserver = new MutationObserver(() => {
        if (coDesign.classList.contains('active')) {
            resetCoDesign();
            // Attach one-time reveal on first click/enter/space
            const oneTimeReveal = (e) => {
                if (!revealedSecond && secondCard && secondCard.classList.contains('seq-hidden')) {
                    secondCard.classList.remove('seq-hidden');
                    revealedSecond = true;
                    // Prevent this first click from also toggling emojis
                    e.stopPropagation();
                    e.stopImmediatePropagation?.();
                }
                coDesign.removeEventListener('click', oneTimeReveal, true);
                coDesign.removeEventListener('keydown', keyHandler, true);
            };
            const keyHandler = (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    oneTimeReveal(e);
                }
            };
            coDesign.addEventListener('click', oneTimeReveal, true); // capture to pre-empt inner handlers
            coDesign.addEventListener('keydown', keyHandler, true);
        }
    });
    cdObserver.observe(coDesign, { attributes: true, attributeFilter: ['class'] });
    coDesign.querySelectorAll('.co-design-card').forEach((card) => {
        const emoji = card.querySelector('.emoji-row');
        if (!emoji) return;
        function toggle() { emoji.classList.toggle('visible'); }
        card.addEventListener('click', toggle);
        card.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); }
        });
    });
});

// Impact metrics: animate numbers when slide becomes active
document.addEventListener('DOMContentLoaded', () => {
    const impactSlide = document.getElementById('slide-9-impact');
    if (!impactSlide) return;
    let animated = false;

    function animateValues() {
        if (animated) return; // one-shot
        const values = impactSlide.querySelectorAll('.metric .value');
        values.forEach((el) => {
            const target = parseFloat(el.dataset.target || '0');
            const suffix = el.dataset.suffix || '';
            const duration = 1100; // ms
            const start = performance.now();
            function tick(now) {
                const t = Math.min(1, (now - start) / duration);
                // easeOutCubic
                const eased = 1 - Math.pow(1 - t, 3);
                const val = target * eased;
                const display = (Math.round(val * 10) / 10).toString();
                el.textContent = (suffix === '%') ? `${display}${suffix}` : `${display}${suffix}`;
                if (t < 1) requestAnimationFrame(tick);
            }
            requestAnimationFrame(tick);
        });
        animated = true;
    }

    // Observe slide activation
    const obs = new MutationObserver(() => {
        if (impactSlide.classList.contains('active')) animateValues();
    });
    obs.observe(impactSlide, { attributes: true, attributeFilter: ['class'] });
    // If already active on load
    if (impactSlide.classList.contains('active')) animateValues();
});

// Ping-pong video playback for slide 7b (forward then backward looping)
// Opening slide: click image to reveal adjacent video, then enable ping-pong playback
document.addEventListener('DOMContentLoaded', () => {
    const opening = document.getElementById('slide-2-opening');
    if (!opening) return;
    const img = opening.querySelector('#opening-image');
    const vid = opening.querySelector('#opening-video');
    if (!img || !vid) return;

    function resetOpening() {
        vid.classList.remove('revealed');
        vid.classList.add('hidden');
        // Pause and reset to start for a clean reveal
        try { vid.pause(); } catch (_) {}
        vid.currentTime = 0;
    }

    // Reset when slide becomes active
    const opObs = new MutationObserver(() => {
        if (opening.classList.contains('active')) {
            resetOpening();
        }
    });
    opObs.observe(opening, { attributes: true, attributeFilter: ['class'] });

    // First click on image reveals video
    let revealed = false;
    img.addEventListener('click', () => {
        if (!revealed) {
            vid.classList.remove('hidden');
            // force reflow to ensure transition
            // eslint-disable-next-line no-unused-expressions
            void vid.offsetWidth;
            vid.classList.add('revealed');
            revealed = true;
            try { vid.play(); } catch (_) {}
        } else {
            // Optional: toggle hide/show on subsequent clicks
            resetOpening();
            revealed = false;
        }
    });

    let direction = 1; // 1 = forward, -1 = backward
    let reverseRaf = null;
    let active = false;
    // Stay a short distance from the exact edges to avoid black frames on some encoders
    const EDGE_MIN = 0.12;   // seconds
    const EDGE_MAX = 0.35;   // seconds
    const EDGE_FRAC = 0.02;  // 2% of duration
    let edgeMarginSec = 0.2; // default until metadata loads
    function computeEdgeMargin(dur) {
        return Math.max(EDGE_MIN, Math.min(EDGE_MAX, dur * EDGE_FRAC));
    }

    function cancelReverseRaf() {
        if (reverseRaf) {
            cancelAnimationFrame(reverseRaf);
            reverseRaf = null;
        }
    }

    function stepReverseRaf() {
        cancelReverseRaf();
        // Pause once and then drive frames manually backwards
        vid.pause();
        let last = performance.now();
        function tick(now) {
            if (!active || direction !== -1) { return; }
            const deltaSec = Math.min(0.05, (now - last) / 1000);
            last = now;
            const next = vid.currentTime - deltaSec;
            if (next <= edgeMarginSec) {
                vid.currentTime = edgeMarginSec; // avoid exact 0 to prevent black flash
                direction = 1;
                vid.play().catch(() => {});
                return;
            }
            vid.currentTime = next;
            reverseRaf = requestAnimationFrame(tick);
        }
        reverseRaf = requestAnimationFrame(tick);
    }

    function onTimeUpdate() {
        if (!Number.isFinite(vid.duration)) return;
        if (direction === 1) {
            // Going forward: when near the end, switch to reverse stepping
            if (vid.currentTime >= vid.duration - edgeMarginSec) {
                direction = -1;
                // Ensure we start exactly from the end frame for smoothness
                vid.pause();
                vid.currentTime = Math.max(0, vid.duration - edgeMarginSec); // avoid exact end frame
                stepReverseRaf();
            }
        }
    }

    function onSlideActivated(isActive) {
        active = isActive;
        if (active) {
            // Reset state and start forward playback
            cancelReverseRaf();
            direction = 1;
            try { vid.play(); } catch (_) {}
        } else {
            // Cleanup when slide not active
            cancelReverseRaf();
            try { vid.pause(); } catch (_) {}
        }
    }

    // Observe slide activation changes
    const observer = new MutationObserver(() => {
        onSlideActivated(opening.classList.contains('active') && revealed);
    });
    observer.observe(opening, { attributes: true, attributeFilter: ['class'] });

    // Hook timeupdate once metadata is ready
    function attachAfterMetadata() {
        edgeMarginSec = computeEdgeMargin(vid.duration || 10);
        vid.addEventListener('timeupdate', onTimeUpdate);
    }
    if (vid.readyState >= 1) { attachAfterMetadata(); }
    else { vid.addEventListener('loadedmetadata', attachAfterMetadata, { once: true }); }

    // If the browser fires 'ended' anyway, treat it like near-end and flip to reverse seamlessly
    vid.addEventListener('ended', () => {
        if (!active) return;
        direction = -1;
        vid.pause();
        vid.currentTime = Math.max(0, vid.duration - edgeMarginSec);
        stepReverseRaf();
    });

    // Start if slide is already active on load
    if (opening.classList.contains('active') && revealed) {
        onSlideActivated(true);
    }
});

// Slide 34: Word embeddings 3D vector-space animation (canvas)
document.addEventListener('DOMContentLoaded', () => {
    const slide = document.getElementById('slide-34-ai-smb-embeddings-example');
    const canvas = document.getElementById('embeddings-canvas');
    if (!slide || !canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const prefersReducedMotion = (() => {
        try { return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches; }
        catch (_) { return false; }
    })();

    const state = {
        dpr: 1,
        width: 0,
        height: 0,
        rafId: null,
        running: false,
        rotX: 0.55,
        rotY: 0,
        userRotX: 0,
        userRotY: 0,
        dragging: false,
        lastX: 0,
        lastY: 0,
        visibleLabels: null, // null = show all
        focusLabels: null,   // Set of labels for the most-recent selection (highlight)
        activeIndex: -1,
        autoRotatePaused: false,
        autoRotateFreezeTime: 0,
    };

    const palette = {
        bg: 'rgba(11,16,32,0.0)',
        axisX: '#00fff7',
        axisY: '#6a67ce',
        axisZ: '#ffd166',
        grid: 'rgba(0,255,247,0.14)',
        label: '#e7f9ff',
        subtle: 'rgba(176,224,255,0.8)',
    };

    // Example word vectors: purely illustrative positions
    const points = [
        // These positions are illustrative: close = similar meaning
        { label: 'King',  color: '#00fff7', x: 0.62, y: 0.18, z: 0.22 },
        { label: 'Queen', color: '#6a67ce', x: 0.56, y: 0.26, z: 0.27 },
        { label: 'Dog',   color: '#7fe8ff', x: -0.45, y: -0.30, z: 0.62 },
        { label: 'Pizza', color: '#ff6f61', x: -0.92, y: 0.44, z: -0.82 },
    ];

    function setRevealState({ visibleLabels, focusLabels, activeIndex }, items) {
        state.visibleLabels = visibleLabels;
        state.focusLabels = focusLabels;
        state.activeIndex = activeIndex;

        if (Array.isArray(items)) {
            for (let i = 0; i < items.length; i++) {
                const el = items[i];
                const isActive = i <= activeIndex;
                el.classList.toggle('active', isActive);
                el.setAttribute('aria-pressed', String(isActive));
            }
        }

        // If paused due to reduced motion, re-render immediately
        if (prefersReducedMotion) render(performance.now());
    }

    function clamp(n, min, max) { return Math.max(min, Math.min(max, n)); }

    function resizeCanvas() {
        const rect = canvas.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        state.dpr = dpr;
        state.width = Math.max(1, rect.width);
        state.height = Math.max(1, rect.height);
        canvas.width = Math.max(1, Math.floor(state.width * dpr));
        canvas.height = Math.max(1, Math.floor(state.height * dpr));
    }

    function rotateY(p, a) {
        const ca = Math.cos(a), sa = Math.sin(a);
        return { x: p.x * ca + p.z * sa, y: p.y, z: -p.x * sa + p.z * ca };
    }

    function rotateX(p, a) {
        const ca = Math.cos(a), sa = Math.sin(a);
        return { x: p.x, y: p.y * ca - p.z * sa, z: p.y * sa + p.z * ca };
    }

    function project(p, cx, cy, scale) {
        // Simple perspective projection
        const fov = 2.8;
        const z = p.z + 1.9;
        const k = fov / z;
        return { x: cx + (p.x * scale) * k, y: cy + (p.y * scale) * k, k, z };
    }

    function drawGlowLine(x1, y1, x2, y2, color, width) {
        ctx.save();
        ctx.strokeStyle = color;
        ctx.lineWidth = width;
        ctx.shadowColor = color;
        ctx.shadowBlur = 12;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
        ctx.restore();
    }

    function drawPoint(x, y, r, color, alpha = 1) {
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.fillStyle = color;
        ctx.shadowColor = color;
        ctx.shadowBlur = 16;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
        // inner highlight
        ctx.shadowBlur = 0;
        ctx.fillStyle = 'rgba(255,255,255,0.55)';
        ctx.beginPath();
        ctx.arc(x - r * 0.25, y - r * 0.25, Math.max(1, r * 0.35), 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }

    function drawLabel(text, x, y, alpha = 1) {
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.font = '600 14px system-ui, -apple-system, Segoe UI, Roboto, Arial';
        ctx.fillStyle = palette.label;
        ctx.shadowColor = 'rgba(0,255,247,0.35)';
        ctx.shadowBlur = 10;
        ctx.fillText(text, x + 10, y - 10);
        ctx.restore();
    }

    function render(t) {
        const cssW = state.width;
        const cssH = state.height;
        const dpr = state.dpr;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

        // Clear
        ctx.clearRect(0, 0, cssW, cssH);

        const cx = cssW / 2;
        const cy = cssH / 2;
        const scale = Math.min(cssW, cssH) * 0.36;

        const autoTime = state.autoRotatePaused ? state.autoRotateFreezeTime : (t || 0);
        const autoRotY = autoTime * 0.00035;
        const autoRotX = 0.55 + Math.sin(autoTime * 0.00025) * 0.12;
        const rotY = autoRotY + state.userRotY;
        const rotX = autoRotX + state.userRotX;

        // Axes (unit lines)
        const axes = [
            { a: { x: -1, y: 0, z: 0 }, b: { x: 1, y: 0, z: 0 }, c: palette.axisX, label: 'X' },
            { a: { x: 0, y: -1, z: 0 }, b: { x: 0, y: 1, z: 0 }, c: palette.axisY, label: 'Y' },
            { a: { x: 0, y: 0, z: -1 }, b: { x: 0, y: 0, z: 1 }, c: palette.axisZ, label: 'Z' },
        ];

        function xform(p) {
            let q = rotateY(p, rotY);
            q = rotateX(q, rotX);
            return q;
        }

        // Light grid in XZ plane (y = 0)
        ctx.save();
        ctx.strokeStyle = palette.grid;
        ctx.lineWidth = 1;
        ctx.shadowColor = 'rgba(0,255,247,0.18)';
        ctx.shadowBlur = 8;
        const gridSteps = 6;
        for (let i = -gridSteps; i <= gridSteps; i++) {
            const v = i / gridSteps;
            const p1 = project(xform({ x: v, y: 0, z: -1 }), cx, cy, scale);
            const p2 = project(xform({ x: v, y: 0, z: 1 }), cx, cy, scale);
            ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.stroke();

            const p3 = project(xform({ x: -1, y: 0, z: v }), cx, cy, scale);
            const p4 = project(xform({ x: 1, y: 0, z: v }), cx, cy, scale);
            ctx.beginPath(); ctx.moveTo(p3.x, p3.y); ctx.lineTo(p4.x, p4.y); ctx.stroke();
        }
        ctx.restore();

        // Draw axes
        for (const ax of axes) {
            const a = project(xform(ax.a), cx, cy, scale);
            const b = project(xform(ax.b), cx, cy, scale);
            drawGlowLine(a.x, a.y, b.x, b.y, ax.c, 2);
        }

        // Axis labels (near positive ends)
        const axisLabels = [
            { p: { x: 1.05, y: 0, z: 0 }, text: 'Regal(ness)', c: palette.axisX },
            { p: { x: 0, y: 1.05, z: 0 }, text: 'No. of legs', c: palette.axisY },
            { p: { x: 0, y: 0, z: 1.05 }, text: "Animal'ness", c: palette.axisZ },
        ];
        ctx.save();
        ctx.font = '800 12px system-ui, -apple-system, Segoe UI, Roboto, Arial';
        for (const lab of axisLabels) {
            const pt = project(xform(lab.p), cx, cy, scale);
            ctx.fillStyle = lab.c;
            ctx.shadowColor = lab.c;
            ctx.shadowBlur = 10;
            ctx.fillText(lab.text, pt.x + 8, pt.y + 8);
        }
        ctx.restore();

        // Draw points back-to-front (simple depth sort)
        const visiblePoints = (state.visibleLabels && state.visibleLabels.size)
            ? points.filter(p => state.visibleLabels.has(p.label))
            : points;

        const projected = visiblePoints.map(p => {
            const q = xform(p);
            const pr = project(q, cx, cy, scale);
            return { ...p, pr, depth: pr.z };
        }).sort((a, b) => b.depth - a.depth);

        // “Similarity” hint line between King and Queen
        const king = projected.find(p => p.label === 'King');
        const queen = projected.find(p => p.label === 'Queen');
        const dog = projected.find(p => p.label === 'Dog');
        const pizza = projected.find(p => p.label === 'Pizza');
        if (king && queen) {
            drawGlowLine(king.pr.x, king.pr.y, queen.pr.x, queen.pr.y, 'rgba(0,255,247,0.45)', 2);
        }
        // “Further away” hint lines (subtler)
        if (king && dog) {
            drawGlowLine(king.pr.x, king.pr.y, dog.pr.x, dog.pr.y, 'rgba(127,232,255,0.22)', 1.5);
        }
        if (king && pizza) {
            drawGlowLine(king.pr.x, king.pr.y, pizza.pr.x, pizza.pr.y, 'rgba(255,111,97,0.18)', 1.5);
        }

        const focus = state.focusLabels;
        for (const p of projected) {
            const r = clamp(7 * (2.2 / p.pr.z), 4.5, 9.5);
            const isFocused = focus && focus.has(p.label);
            const alpha = (focus && !isFocused) ? 0.38 : 1;
            drawPoint(p.pr.x, p.pr.y, r, p.color, alpha);
            drawLabel(p.label, p.pr.x, p.pr.y, alpha);
        }

        // Footer hint
        ctx.save();
        ctx.font = '500 12px system-ui, -apple-system, Segoe UI, Roboto, Arial';
        ctx.fillStyle = palette.subtle;
        ctx.shadowColor = 'rgba(0,255,247,0.25)';
        ctx.shadowBlur = 8;
        ctx.fillText('Closer points ≈ more similar meaning', 12, cssH - 14);
        ctx.restore();
    }

    function start() {
        if (state.running) return;
        state.running = true;
        resizeCanvas();

        if (prefersReducedMotion) {
            render(performance.now());
            state.running = false;
            return;
        }

        const tick = (t) => {
            if (!state.running) return;
            render(t);
            state.rafId = requestAnimationFrame(tick);
        };
        state.rafId = requestAnimationFrame(tick);
    }

    function stop() {
        state.running = false;
        if (state.rafId) cancelAnimationFrame(state.rafId);
        state.rafId = null;
    }

    // Drag to rotate
    canvas.addEventListener('pointerdown', (e) => {
        state.dragging = true;
        state.lastX = e.clientX;
        state.lastY = e.clientY;
        try { canvas.setPointerCapture(e.pointerId); } catch (_) {}
    });
    canvas.addEventListener('pointermove', (e) => {
        if (!state.dragging) return;
        const dx = e.clientX - state.lastX;
        const dy = e.clientY - state.lastY;
        state.lastX = e.clientX;
        state.lastY = e.clientY;
        state.userRotY += dx * 0.01;
        state.userRotX = clamp(state.userRotX + dy * 0.01, -1.1, 1.1);
        // If paused due to reduced motion, just re-render once on interaction
        if (prefersReducedMotion) render(performance.now());
    });
    function endDrag() { state.dragging = false; }
    canvas.addEventListener('pointerup', endDrag);
    canvas.addEventListener('pointercancel', endDrag);
    canvas.addEventListener('mouseleave', endDrag);

    // Resize handling
    window.addEventListener('resize', () => {
        if (!slide.classList.contains('active')) return;
        resizeCanvas();
        render(performance.now());
    });

    // Start/stop based on slide visibility
    const obs = new MutationObserver(() => {
        if (slide.classList.contains('active')) start();
        else stop();
    });
    obs.observe(slide, { attributes: true, attributeFilter: ['class'] });

    // If already active on load
    if (slide.classList.contains('active')) start();

    // List-item click filtering (cumulative by list order)
    const noticeList = slide.querySelector('.quote-card ul.shift-bullets');
    if (noticeList) {
        const items = Array.from(noticeList.querySelectorAll('li.embed-filter'));

        const parseLabels = (raw) => {
            const key = String(raw || '').trim();
            if (!key) return { mode: 'none', labels: [] };
            if (key.toUpperCase() === 'ALL') return { mode: 'all', labels: [] };
            return { mode: 'set', labels: key.split(',').map(s => s.trim()).filter(Boolean) };
        };

        const computeRevealForIndex = (idx) => {
            if (idx < 0) {
                return { visibleLabels: null, focusLabels: null, activeIndex: -1 };
            }

            const focusInfo = parseLabels(items[idx]?.dataset?.show);
            if (focusInfo.mode === 'all') {
                return {
                    visibleLabels: null,
                    focusLabels: new Set(points.map(p => p.label)),
                    activeIndex: idx,
                };
            }

            const visible = new Set();
            for (let i = 0; i <= idx; i++) {
                const info = parseLabels(items[i]?.dataset?.show);
                if (info.mode === 'all') {
                    // If any earlier item is ALL, everything is visible.
                    return {
                        visibleLabels: null,
                        focusLabels: new Set(points.map(p => p.label)),
                        activeIndex: idx,
                    };
                }
                for (const l of info.labels) visible.add(l);
            }

            return {
                visibleLabels: visible.size ? visible : null,
                focusLabels: focusInfo.labels.length ? new Set(focusInfo.labels) : null,
                activeIndex: idx,
            };
        };

        const rotationIndex = items.findIndex((el) => {
            const info = parseLabels(el?.dataset?.show);
            return info.mode === 'all';
        });

        const applyReveal = (idx) => {
            // Clicking an already-revealed step toggles it off (step back one)
            const nextIdx = (idx === state.activeIndex) ? (idx - 1) : idx;

            // Pause auto-rotation when the Rotation step is active; resume otherwise
            const shouldPause = rotationIndex >= 0 && nextIdx >= rotationIndex;
            if (shouldPause && !state.autoRotatePaused) {
                state.autoRotatePaused = true;
                state.autoRotateFreezeTime = performance.now();
            } else if (!shouldPause && state.autoRotatePaused) {
                state.autoRotatePaused = false;
            }

            setRevealState(computeRevealForIndex(nextIdx), items);
            render(performance.now());
        };

        for (let i = 0; i < items.length; i++) {
            const li = items[i];
            li.setAttribute('aria-pressed', 'false');
            li.addEventListener('click', () => applyReveal(i));
            li.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    applyReveal(i);
                }
            });
        }
    }
});
