let html5QrcodeScanner = new Html5QrcodeScanner(
    "reader", { fps: 10, qrbox: 250 });

// Track daily attendance status
let dailyAttendance = {};

// Initialize daily attendance at start of day
function initializeDailyAttendance() {
    const today = new Date().toLocaleDateString();
    if (!dailyAttendance[today]) {
        dailyAttendance[today] = {};
        for (let staffId in STAFF_DATA) {
            dailyAttendance[today][staffId] = {
                status: 'absent',
                checkInTime: null
            };
        }
    }
}

function onScanSuccess(decodedText, decodedResult) {
    const staffId = decodedText;
    const staff = STAFF_DATA[staffId];
    
    if (!staff) {
        document.getElementById('lastScan').textContent = "Invalid QR Code: Staff not found";
        console.log("Scanned ID:", staffId); // For debugging
        return;
    }

    const now = new Date();
    const today = now.toLocaleDateString();
    initializeDailyAttendance();

    const timeDiff = staff.lastScan ? (now - new Date(staff.lastScan)) / 1000 : 121;

    if (timeDiff < 120) { // 2 minutes cooldown
        document.getElementById('lastScan').textContent = 
            `Please wait ${Math.ceil((120 - timeDiff))} seconds before scanning again`;
        return;
    }

    staff.lastScan = now;
    const timestamp = now.toLocaleString('en-GB', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
    }).replace(',', '');

    // Mark as present when checked in
    dailyAttendance[today][staffId].status = 'present';
    dailyAttendance[today][staffId].checkInTime = now;

    const scanType = timeDiff > 120 ? "Check In" : "Check Out";
    
    const attendanceData = {
        timestamp: timestamp,
        staffId: staffId,            // Staff ID is being sent
        staffName: staff.name,
        type: scanType,
        status: scanType === "Check In" ? "present" : "checked-out"
    };

    submitAttendance(attendanceData);
    
    // Show staff ID in the success message
    document.getElementById('lastScan').textContent = 
        `${staff.name} (${staffId}) - ${scanType} recorded at ${timestamp}`;
}

// Check for absent staff after 12 PM
function checkAbsentStaff() {
    const now = new Date();
    const today = now.toLocaleDateString();
    
    // Only run after 12 PM
    if (now.getHours() >= 12) {
        initializeDailyAttendance();
        
        for (let staffId in dailyAttendance[today]) {
            if (dailyAttendance[today][staffId].status === 'absent') {
                const staff = STAFF_DATA[staffId];
                const timestamp = now.toLocaleString('en-GB', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: false
                }).replace(',', '');

                const attendanceData = {
                    timestamp: timestamp,
                    staffId: staffId,
                    staffName: staff.name,
                    type: 'No Show',
                    status: 'absent'
                };

                submitAttendance(attendanceData);
            }
        }
    }
}

async function submitAttendance(data) {
    try {
        const response = await fetch(GOOGLE_SCRIPT_URL, {
            method: 'POST',
            mode: 'no-cors',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(data)
        });

        document.getElementById('lastScan').textContent = 
            `${data.staffName} (${data.staffId}) - ${data.type} recorded at ${data.timestamp}`;
    } catch (error) {
        console.error('Error submitting attendance:', error);
        document.getElementById('lastScan').textContent = 
            "Failed to record attendance. Please try again.";
    }
}

// Check for absent staff every hour
setInterval(checkAbsentStaff, 3600000); // Run every hour

// Initialize scanner
html5QrcodeScanner.render(onScanSuccess);