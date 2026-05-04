
//المتغيرات HTML

let title = document.querySelector(".title");
let ul = document.querySelector("ul");
let reload = document.querySelector(".reload");
let fastPanel = document.querySelector(".fast-panel");
let speedValue = document.querySelector(".speed-value");
let speedNote = document.querySelector(".fast-note");
let speedBtn = document.querySelector(".speed-btn");
let socialLinks = document.querySelector(".social-links");

//variables التحكم
let particleColor = "#ff4d4d"; // لون الخلفيه 
let statusCheckTimer = null; //التايمر
let currentStatus = null; // الحاله OFF , ON 
let isCheckingConnection = false; //منع التكرار
let isTestingSpeed = false; //منع تكرار اختبار السرعة
const SPEED_TEST_DURATION_MS = 10000; //مدة اختبار السرعة
const COUNTDOWN_REFRESH_MS = 100; //تحديث العد التنازلي بشكل ناعم
const SPEED_TEST_PARALLEL_CONNECTIONS = 4; //عدد الاتصالات المتوازية
const SPEED_TEST_CHUNK_BYTES = 4000000; //حجم كل تحميلة في القياس
const SPEED_TEST_WARMUP_MS = 1200; //تجاهل بداية القياس لزيادة الدقة
let speedDisplayAnimationId = null; //انيميشن عرض السرعة
let speedSmoother = null; //متحكم تنعيم السرعة


// فنكشن تغير اللون

function updateParticleColors(color) {
    particleColor = color;
    if (window.tsParticles && tsParticles.domItem(0)) {
        tsParticles.domItem(0).options.particles.color.value = color;
        tsParticles.domItem(0).options.particles.links.color = color;
        tsParticles.domItem(0).refresh();
    }
}

//فنكشن الانترنت

async function hasRealInternetConnection() {
    if (!window.navigator.onLine) {
        return false;
    }

    const checkUrls = [
        "https://www.gstatic.com/generate_204",
        "https://www.google.com/favicon.ico",
    ];

    for (const url of checkUrls) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(function () {
                controller.abort();
            }, 3000);

            await fetch(url + "?t=" + Date.now(), {
                method: "GET",
                mode: "no-cors",
                cache: "no-store",
                signal: controller.signal,
            });

            clearTimeout(timeoutId);
            return true;
        } catch (error) {
            // Try next endpoint.
        }
    }

    return false;
}
// لقراة الجهاز اونلاين ولا اوف لاين

async function syncConnectionState() {
    if (isCheckingConnection) {
        return;
    }
    isCheckingConnection = true;
    try {
        const isOnline = await hasRealInternetConnection();
        const nextStatus = isOnline ? "online" : "offline";
        if (currentStatus !== nextStatus) {
            currentStatus = nextStatus;
            if (isOnline) {
                onLine();
            } else {
                offLine();
            }
        }
    } finally {
        isCheckingConnection = false;
    }
}

async function runSpeedTest() {
    if (isTestingSpeed) {
        return;
    }

    if (currentStatus !== "online") {
        speedValue.textContent = "0.00";
        speedNote.textContent = "You are offline now";
        return;
    }

    isTestingSpeed = true;
    speedBtn.disabled = true;
    speedBtn.textContent = "Testing...";
    speedNote.textContent = "Measuring for 10 seconds...";
    speedValue.textContent = "0.00";
    socialLinks.classList.add("hide");
    const stopCountdown = startSmoothCountdown(SPEED_TEST_DURATION_MS);
    speedSmoother = createLiveSpeedSmoother();

    try {
        const mbps = await measureDownloadSpeedForDuration(SPEED_TEST_DURATION_MS);

        if (!Number.isFinite(mbps) || mbps <= 0) {
            throw new Error("Invalid speed result");
        }

        speedSmoother.push(mbps);
        speedSmoother.finish();
        speedNote.textContent = "Final result after 10 seconds";
    } catch (error) {
        const fallback = getEstimatedDownlinkSpeed();
        if (fallback > 0) {
            speedSmoother.push(fallback);
            speedSmoother.finish();
            speedNote.textContent = "Estimated from device network info";
        } else {
            speedSmoother.stop();
            speedValue.textContent = "0.00";
            speedNote.textContent = "Unable to measure speed right now";
        }
    } finally {
        stopCountdown();
        speedSmoother.stop();
        speedSmoother = null;
        isTestingSpeed = false;
        speedBtn.disabled = false;
        speedBtn.textContent = "Speed Test";
        socialLinks.classList.remove("hide");
    }
}

function startSmoothCountdown(durationMs) {
    const startedAt = performance.now();

    function updateCountdownNote() {
        const elapsed = performance.now() - startedAt;
        const remainingMs = Math.max(0, durationMs - elapsed);
        const remainingSeconds = (remainingMs / 1000).toFixed(1);
        speedNote.textContent = "Testing... " + remainingSeconds + "s left";
    }

    updateCountdownNote();
    const timerId = setInterval(updateCountdownNote, COUNTDOWN_REFRESH_MS);

    return function stopCountdown() {
        clearInterval(timerId);
    };
}

function createLiveSpeedSmoother() {
    let targetMbps = 0;
    let displayedMbps = parseFloat(speedValue.textContent) || 0;
    let active = true;
    const easing = 0.18;

    function step() {
        if (!active) {
            return;
        }

        displayedMbps += (targetMbps - displayedMbps) * easing;

        if (Math.abs(targetMbps - displayedMbps) < 0.02) {
            displayedMbps = targetMbps;
        }

        speedValue.textContent = displayedMbps.toFixed(2);
        speedDisplayAnimationId = requestAnimationFrame(step);
    }

    speedDisplayAnimationId = requestAnimationFrame(step);

    return {
        push(nextMbps) {
            if (!Number.isFinite(nextMbps) || nextMbps < 0) {
                return;
            }
            targetMbps = nextMbps;
        },
        finish() {
            displayedMbps = targetMbps;
            speedValue.textContent = displayedMbps.toFixed(2);
        },
        stop() {
            active = false;
            if (speedDisplayAnimationId !== null) {
                cancelAnimationFrame(speedDisplayAnimationId);
                speedDisplayAnimationId = null;
            }
        },
    };
}

function getEstimatedDownlinkSpeed() {
    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    const value = connection && connection.downlink;
    return typeof value === "number" ? value : 0;
}

async function measureDownloadSpeedMbps(timeoutMs) {
    const uniqueSeed = Date.now() + "-" + Math.random().toString(16).slice(2);
    const endpoints = [
        "https://speed.cloudflare.com/__down?bytes=" + SPEED_TEST_CHUNK_BYTES + "&cacheBust=" + uniqueSeed,
        "https://cdn.jsdelivr.net/gh/jquery/jquery@3.7.1/dist/jquery.js?cacheBust=" + uniqueSeed,
    ];

    for (const url of endpoints) {
        try {
            const sample = await runSingleSpeedRequest(url, timeoutMs);
            if (sample.mbps > 0) {
                return sample;
            }
        } catch (error) {
            // Try next endpoint
        }
    }

    throw new Error("All speed endpoints failed");
}

async function measureDownloadSpeedForDuration(durationMs) {
    const startedAt = performance.now();
    const deadline = startedAt + durationMs;
    const warmupEnd = startedAt + SPEED_TEST_WARMUP_MS;
    let measuredBytes = 0;

    async function workerLoop() {
        while (performance.now() < deadline && currentStatus === "online") {
            const now = performance.now();
            const remainingMs = Math.floor(deadline - now);
            if (remainingMs <= 250) {
                break;
            }

            try {
                const sample = await measureDownloadSpeedMbps(Math.min(remainingMs, 7000));
                const sampleEnd = performance.now();
                const sampleDurationMs = sample.durationSeconds * 1000;
                const sampleStart = sampleEnd - sampleDurationMs;

                const countedStart = Math.max(sampleStart, warmupEnd);
                const countedEnd = Math.min(sampleEnd, deadline);
                const countedMs = Math.max(0, countedEnd - countedStart);

                if (countedMs > 0 && sampleDurationMs > 0) {
                    const countedRatio = countedMs / sampleDurationMs;
                    measuredBytes += sample.bytesLoaded * countedRatio;
                }

                const elapsedSinceWarmupMs = Math.max(0, Math.min(sampleEnd, deadline) - warmupEnd);
                const elapsedSinceWarmupSec = Math.max(elapsedSinceWarmupMs / 1000, 0.001);
                const liveMbps = (measuredBytes * 8) / elapsedSinceWarmupSec / 1000000;
                if (speedSmoother && Number.isFinite(liveMbps) && liveMbps >= 0) {
                    speedSmoother.push(liveMbps);
                }
            } catch (error) {
                // Ignore single request failures and continue sampling.
            }
        }
    }

    const workers = [];
    for (let i = 0; i < SPEED_TEST_PARALLEL_CONNECTIONS; i += 1) {
        workers.push(workerLoop());
    }
    await Promise.all(workers);

    if (measuredBytes <= 0) {
        throw new Error("No successful speed samples");
    }

    const effectiveEnd = Math.min(performance.now(), deadline);
    const effectiveSeconds = Math.max((effectiveEnd - warmupEnd) / 1000, 0.5);
    return (measuredBytes * 8) / effectiveSeconds / 1000000;
}

async function runSingleSpeedRequest(url, timeoutMs) {
    const controller = new AbortController();
    const safeTimeoutMs = Number.isFinite(timeoutMs) ? timeoutMs : 15000;
    const timeoutId = setTimeout(function () {
        controller.abort();
    }, Math.max(1500, safeTimeoutMs));

    try {
        const start = performance.now();
        const response = await fetch(url, {
            method: "GET",
            cache: "no-store",
            signal: controller.signal,
        });

        if (!response.ok) {
            throw new Error("Bad response");
        }

        let bytesLoaded = 0;
        if (response.body && response.body.getReader) {
            const reader = response.body.getReader();
            while (true) {
                const chunk = await reader.read();
                if (chunk.done) {
                    break;
                }
                bytesLoaded += chunk.value.length;
            }
        } else {
            const data = await response.arrayBuffer();
            bytesLoaded = data.byteLength;
        }

        const durationSeconds = (performance.now() - start) / 1000;
        if (durationSeconds <= 0 || bytesLoaded <= 0) {
            throw new Error("Invalid speed data");
        }

        const bitsLoaded = bytesLoaded * 8;
        return {
            mbps: (bitsLoaded / durationSeconds) / 1000000,
            bytesLoaded: bytesLoaded,
            durationSeconds: durationSeconds,
        };
    } finally {
        clearTimeout(timeoutId);
    }
}

function animateSpeedValue(targetMbps) {
    const safeTarget = Math.max(0, targetMbps);
    const durationMs = 700;
    const startValue = parseFloat(speedValue.textContent) || 0;
    const startTime = performance.now();

    function step(now) {
        const progress = Math.min((now - startTime) / durationMs, 1);
        const nextValue = startValue + (safeTarget - startValue) * progress;
        speedValue.textContent = nextValue.toFixed(1);
        if (progress < 1) {
            requestAnimationFrame(step);
        }
    }

    requestAnimationFrame(step);
}

window.onload = function () {
    syncConnectionState();
    statusCheckTimer = setInterval(syncConnectionState, 2000);
};

window.addEventListener("online", function () {
    syncConnectionState();
});

window.addEventListener("offline", function () {
    currentStatus = "offline";
    offLine();
});

window.addEventListener("focus", function () {
    syncConnectionState();
});

reload.onclick = function () {
    syncConnectionState();
};

speedBtn.onclick = function () {
    runSpeedTest();
};

function onLine() {
    document.body.classList.remove("status-offline");
    document.body.classList.add("status-online");
    title.innerHTML = "Online Now";
    title.style.color = "#c9ffd5";
    updateParticleColors("#4dff88");
    ul.classList.add("hide");
    reload.classList.add("hide");
    fastPanel.classList.remove("hide");
    speedBtn.disabled = false;
    speedValue.textContent = "0.00";
    speedNote.textContent = "Press Speed Test to measure";
    socialLinks.classList.add("hide");
}
function offLine() {
    document.body.classList.remove("status-online");
    document.body.classList.add("status-offline");
    title.innerHTML = "Offline Now";
    title.style.color = "#ffd6d6";
    updateParticleColors("#ff4d4d");
    ul.classList.remove("hide");
    reload.classList.remove("hide");
    fastPanel.classList.add("hide");
    speedBtn.disabled = false;
    speedBtn.textContent = "Speed Test";
    speedValue.textContent = "0.00";
    speedNote.textContent = "Press Speed Test to measure";
    socialLinks.classList.add("hide");
}

//دا خاص بالخلفيه فقط
tsParticles.load("tsparticles", {
    background: {
        color: "#050505",
    },
    particles: {
        number: {
            value: 80,
        },
        color: {
            value: "#00ffff",
        },
        links: {
            enable: true,
            color: "#00ffff",
            distance: 150,
            opacity: 0.25,
            width: 1,
        },
        move: {
            enable: true,
            speed: 2,
        },
        size: {
            value: 3,
        },
    },
    interactivity: {
        events: {
            onHover: {
                enable: true,
                mode: "repulse",
            },
        },
    },
    
    //جزء الميديا كويري 

    responsive: [
        {
            maxWidth: 768,
            options: {
                particles: {
                    number: {
                        value: 55,
                    },
                    move: {
                        speed: 1.4,
                    },
                },
            },
        },
        {
            maxWidth: 480,
            options: {
                particles: {
                    number: {
                        value: 35,
                    },
                    move: {
                        speed: 1,
                    },
                    links: {
                        distance: 120,
                        opacity: 0.2,
                    },
                },
            },
        },
    ],
});
