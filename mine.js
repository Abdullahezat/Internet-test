
//المتغيرات HTML

let title = document.querySelector(".title");
let ul = document.querySelector("ul");
let reload = document.querySelector(".reload");

//variables التحكم
let particleColor = "#ff4d4d"; // لون الخلفيه 
let statusCheckTimer = null; //التايمر
let currentStatus = null; // الحاله OFF , ON 
let isCheckingConnection = false; //منع التكرار


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

function onLine() {
    document.body.classList.remove("status-offline");
    document.body.classList.add("status-online");
    title.innerHTML = "Online Now";
    title.style.color = "#c9ffd5";
    updateParticleColors("#4dff88");
    ul.classList.add("hide");
    reload.classList.add("hide");
}
function offLine() {
    document.body.classList.remove("status-online");
    document.body.classList.add("status-offline");
    title.innerHTML = "Offline Now";
    title.style.color = "#ffd6d6";
    updateParticleColors("#ff4d4d");
    ul.classList.remove("hide");
    reload.classList.remove("hide");
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
