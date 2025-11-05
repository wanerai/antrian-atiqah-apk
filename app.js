document.addEventListener('DOMContentLoaded', () => {
    // --- ELEMEN DOM ---
    const printButton = document.getElementById('printButton');
    const connectBtn = document.getElementById('connectBtn');
    const resetBtn = document.getElementById('resetBtn');
    const currentNumberDisplay = document.getElementById('currentNumber');
    const statusPrinter = document.getElementById('statusPrinter');
    const displayInfoContainer = document.getElementById('displayInfoContainer');
    
    // Elemen Modal Pengaturan
    const settingsBtn = document.getElementById('settingsBtn');
    const settingsModal = document.getElementById('settingsModal');
    const closeSettingsBtn = document.getElementsByClassName('close-settings')[0];
    const previewBtnInSettings = document.getElementById('previewBtnInSettings');
    const changePasswordBtn = document.getElementById('changePasswordBtn');

    // Elemen Modal Password
    const passwordModal = document.getElementById('passwordModal');
    const closePasswordBtn = document.getElementsByClassName('close-password')[0];
    const passwordForm = document.getElementById('passwordForm');
    const currentPasswordInput = document.getElementById('currentPasswordInput');
    const newPasswordInput = document.getElementById('newPasswordInput');
    const confirmPasswordInput = document.getElementById('confirmPasswordInput');
    const cancelPasswordBtn = document.getElementById('cancelPasswordBtn');

    // Elemen Modal Pratinjau
    const previewModal = document.getElementById('previewModal');
    const closePreviewBtn = document.getElementsByClassName('close-preview')[0];
    const previewContainer = document.getElementById('previewContainer');

    const toggleDisplay = document.getElementById('toggleDisplay');

    // --- VARIABEL GLOBAL ---
    let bluetoothDevice = null;
    let bluetoothCharacteristic = null;
    let currentQueueNumber = 0;
    const BLUETOOTH_SERVICE_UUID = '00001101-0000-1000-8000-00805f9b34fb';
    const BLUETOOTH_CHARACTERISTIC_UUID = '49535343-8841-43f4-a8d4-ecbe34729bb3';
    const DEFAULT_PASSWORD = '0987';
    const PASSWORD_KEY = 'appPassword';

    // --- INISIALISASI ---
    function init() {
        // Inisialisasi password default jika belum ada
        if (!localStorage.getItem(PASSWORD_KEY)) {
            localStorage.setItem(PASSWORD_KEY, DEFAULT_PASSWORD);
        }

        loadQueueNumber();
        loadSettings();
        applySettings();

        printButton.addEventListener('click', handlePrintTicket);
        connectBtn.addEventListener('click', connectBluetooth);
        resetBtn.addEventListener('click', resetQueue);
        
        // Event Listener untuk Pengaturan
        settingsBtn.addEventListener('click', requestPassword);
        closeSettingsBtn.onclick = () => settingsModal.style.display = 'none';
        previewBtnInSettings.addEventListener('click', generatePreview);
        changePasswordBtn.addEventListener('click', () => passwordModal.style.display = 'block');
        
        // Event Listener untuk Modal Password
        closePasswordBtn.onclick = () => closePasswordModal();
        cancelPasswordBtn.onclick = () => closePasswordModal();
        passwordForm.addEventListener('submit', handlePasswordChange);
        
        // Event Listener untuk Pratinjau
        closePreviewBtn.onclick = () => previewModal.style.display = 'none';

        toggleDisplay.addEventListener('change', () => saveAndApplySetting('showDisplay', toggleDisplay, displayInfoContainer));
    }

    // --- FUNGSI LOCAL STORAGE (Nomor Antrian) ---
    function loadQueueNumber() {
        const savedNumber = localStorage.getItem('clinicQueueNumber');
        currentQueueNumber = savedNumber ? parseInt(savedNumber) : 0;
        updateNumberDisplay();
    }

    function saveQueueNumber() {
        localStorage.setItem('clinicQueueNumber', currentQueueNumber.toString());
    }

    function updateNumberDisplay() {
        currentNumberDisplay.textContent = `A${String(currentQueueNumber).padStart(3, '0')}`;
    }

    // --- FUNGSI PENGATURAN ---
    function requestPassword() {
        const password = prompt('Masukkan password untuk membuka pengaturan:');
        const storedPassword = localStorage.getItem(PASSWORD_KEY);
        if (password === storedPassword) {
            settingsModal.style.display = 'block';
        } else if (password !== null) {
            alert('Password salah!');
        }
    }

    function loadSettings() {
        toggleDisplay.checked = localStorage.getItem('showDisplay') !== 'false';
    }

    function saveAndApplySetting(key, checkbox, element) {
        localStorage.setItem(key, checkbox.checked);
        element.classList.toggle('hidden', !checkbox.checked);
    }

    function applySettings() {
        displayInfoContainer.classList.toggle('hidden', !toggleDisplay.checked);
    }

    // --- FUNGSI UBAH PASSWORD ---
    function handlePasswordChange(event) {
        event.preventDefault(); // Mencegah form submit biasa

        const currentPass = currentPasswordInput.value;
        const newPass = newPasswordInput.value;
        const confirmPass = confirmPasswordInput.value;
        const storedPassword = localStorage.getItem(PASSWORD_KEY);

        // Validasi
        if (currentPass !== storedPassword) {
            alert('Password saat ini salah!');
            return;
        }

        if (newPass !== confirmPass) {
            alert('Password baru dan konfirmasi tidak cocok!');
            return;
        }

        if (newPass.length < 4) {
            alert('Password baru harus memiliki minimal 4 karakter!');
            return;
        }

        // Simpan password baru
        localStorage.setItem(PASSWORD_KEY, newPass);
        alert('Password berhasil diubah!');
        closePasswordModal();
    }

    function closePasswordModal() {
        passwordModal.style.display = 'none';
        passwordForm.reset(); // Kosongkan form
    }

    // --- FUNGSI BLUETOOTH ---
    async function connectBluetooth() {
        try {
            statusPrinter.textContent = 'Mencari printer...';
            bluetoothDevice = await navigator.bluetooth.requestDevice({
                acceptAllDevices: true,
                optionalServices: [BLUETOOTH_SERVICE_UUID]
            });

            statusPrinter.textContent = 'Menghubungkan...';
            const server = await bluetoothDevice.gatt.connect();
            const service = await server.getPrimaryService(BLUETOOTH_SERVICE_UUID);
            bluetoothCharacteristic = await service.getCharacteristic(BLUETOOTH_CHARACTERISTIC_UUID);

            statusPrinter.textContent = `Printer Terhubung: ${bluetoothDevice.name}`;
            statusPrinter.style.color = '#27ae60';
            connectBtn.textContent = 'Terhubung';
            connectBtn.disabled = true;
            
            bluetoothDevice.addEventListener('gattserverdisconnected', onDisconnected);
            
        } catch (error) {
            console.error('Koneksi Bluetooth Gagal:', error);
            statusPrinter.textContent = 'Koneksi Gagal. Coba lagi.';
            statusPrinter.style.color = '#c0392b';
        }
    }

    function onDisconnected() {
        console.log('Bluetooth Device disconnected');
        statusPrinter.textContent = 'Printer Terputus.';
        statusPrinter.style.color = '#c0392b';
        connectBtn.textContent = 'Hubungkan Printer';
        connectBtn.disabled = false;
        bluetoothDevice = null;
        bluetoothCharacteristic = null;
    }

    // --- FUNGSI PENCETAKAN (DIPERBARUI) ---
    async function handlePrintTicket() {
        if (!bluetoothCharacteristic) {
            alert('Printer belum terhubung! Silakan hubungkan printer terlebih dahulu melalui menu Pengaturan.');
            return;
        }

        currentQueueNumber++;
        saveQueueNumber();
        updateNumberDisplay();

        try {
            const encoder = new EscPosEncoder();
            
            const printData = encoder
                .initialize()
                .align('center')
                .line('KLINIK ATIQAH MEDICAL')
                .line('------------------------')
                .line('NOMOR ANTRIAN')
                .size(2, 2)
                .bold(true)
                .line(`A${String(currentQueueNumber).padStart(3, '0')}`)
                .bold(false)
                .size(1, 1)
                .line('------------------------')
                .line(`${new Date().toLocaleDateString('id-ID')} ${new Date().toLocaleTimeString('id-ID')}`)
                .line('Terima Kasih')
                .line('Mohon Menunggu Panggilan')
                .cut()
                .encode();

            await bluetoothCharacteristic.writeValue(printData);
            console.log('Tiket berhasil dicetak!');

        } catch (error) {
            console.error('Gagal mencetak:', error);
            alert('Gagal mencetak. Pastikan printer menyala dan terhubung.');
        }
    }

    // --- FUNGSI PRATINJAU (DIPERBARUI) ---
    function generatePreview() {
        const nextNumber = currentQueueNumber + 1;
        const formattedNumber = `A${String(nextNumber).padStart(3, '0')}`;
        const now = new Date();
        const dateString = now.toLocaleDateString('id-ID');
        const timeString = now.toLocaleTimeString('id-ID');

        // HTML pratinjau disesuaikan dengan format cetak baru
        const previewHTML = `
            <div class="preview-header">KLINIK ATIQAH MEDICAL</div>
            <div>------------------------</div>
            <div>NOMOR ANTRIAN</div>
            <div class="preview-number">${formattedNumber}</div>
            <div>------------------------</div>
            <div>${dateString} ${timeString}</div>
            <div>Terima Kasih</div>
            <div>Mohon Menunggu Panggilan</div>
        `;

        previewContainer.innerHTML = previewHTML;
        previewModal.style.display = 'block';
    }

    function resetQueue() {
        if (confirm('Apakah Anda yakin ingin mereset nomor antrian?')) {
            currentQueueNumber = 0;
            saveQueueNumber();
            updateNumberDisplay();
            alert('Nomor antrian telah direset.');
        }
    }

    // --- EVENT LISTENER UNTUK MODAL ---
    window.onclick = function(event) {
        if (event.target == settingsModal) {
            settingsModal.style.display = 'none';
        }
        if (event.target == previewModal) {
            previewModal.style.display = 'none';
        }
        if (event.target == passwordModal) {
            passwordModal.style.display = 'none';
        }
    }

    // Cek apakah browser mendukung Web Bluetooth
    if (!navigator.bluetooth) {
        alert('Browser Anda tidak mendukung Web Bluetooth. Gunakan browser Chrome di Android.');
        statusPrinter.textContent = 'Browser Tidak Kompatibel';
    } else {
        init();
    }
});