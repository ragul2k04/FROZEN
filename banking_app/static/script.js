document.addEventListener('DOMContentLoaded', () => {

    const API_URL = window.location.origin;

    // --- Page: index.html ---
    const bankSelect = document.getElementById('bankSelect');
    const bankLogo = document.getElementById('bankLogo');
    const nextBtn = document.getElementById('nextBtn');

    if (bankSelect) {
        bankSelect.addEventListener('change', () => {
            const selectedBank = bankSelect.value;
            if (selectedBank) {
                sessionStorage.setItem('selectedBank', selectedBank);
                nextBtn.disabled = false;
            } else {
                nextBtn.disabled = true;
            }
        });

        nextBtn.addEventListener('click', () => {
            window.location.href = '/verification';
        });
    }

    // --- Page: verification.html ---
    const verificationForm = document.getElementById('verificationForm');
    const verificationBankName = document.getElementById('verification-bank-name');

    if (verificationForm) {
        const selectedBank = sessionStorage.getItem('selectedBank');
        if (selectedBank) {
            verificationBankName.textContent = `${selectedBank} - Customer Verification`;
        } else {
            window.location.href = '/';
            return;
        }

        verificationForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const accountNumber = document.getElementById('accountNumber').value;
            const fullName = document.getElementById('fullName').value;
            const mobileNumber = document.getElementById('mobileNumber').value;
            const errorMessage = document.getElementById('error-message');

            if (!validateAccountNumber(accountNumber, selectedBank) || !validateName(fullName) || !validateMobile(mobileNumber)) {
                return;
            }

            const response = await fetch(`${API_URL}/api/verify_customer`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    accountNumber,
                    name: fullName,
                    mobile: mobileNumber
                })
            });

            const result = await response.json();

            if (response.ok && result.success) {
                sessionStorage.setItem('customerDetails', JSON.stringify({
                    accountNumber,
                    name: fullName,
                    mobile: mobileNumber,
                    bank: selectedBank
                }));
                window.location.href = '/transaction';
            } else {
                errorMessage.textContent = result.message || 'Verification failed. Please check your details.';
                errorMessage.style.display = 'block';
            }
        });
    }

    // --- Page: transaction.html ---
    const submitTransaction = document.getElementById('submitTransaction');

    if(submitTransaction){
        submitTransaction.addEventListener('click', () => {
            const transactionType = document.querySelector('input[name="transactionType"]:checked');
            const amount = document.getElementById('amount').value;

            if (!transactionType) {
                alert('Please select a transaction type.');
                return;
            }
            if (parseFloat(amount) <= 0 || !amount) {
                alert('Please enter a valid amount.');
                return;
            }

            sessionStorage.setItem('transactionDetails', JSON.stringify({
                type: transactionType.value,
                amount: amount
            }));

            window.location.href = '/eform';
        });
    }

    // --- Page: eform.html ---
    const eformToken = document.getElementById('eform-token');
    if (eformToken) {
        const customerDetails = JSON.parse(sessionStorage.getItem('customerDetails'));
        const transactionDetails = JSON.parse(sessionStorage.getItem('transactionDetails'));

        if (!customerDetails || !transactionDetails) {
            window.location.href = '/';
            return;
        }

        document.getElementById('eform-bank').textContent = customerDetails.bank;
        document.getElementById('eform-account').textContent = customerDetails.accountNumber;
        document.getElementById('eform-name').textContent = customerDetails.name;
        document.getElementById('eform-mobile').textContent = customerDetails.mobile;
        document.getElementById('eform-type').textContent = transactionDetails.type;
        document.getElementById('eform-amount').textContent = transactionDetails.amount;

        // Generate Token via API call
        const generateAndDisplayToken = async () => {
            const response = await fetch(`${API_URL}/api/generate_token`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    accountNumber: customerDetails.accountNumber,
                    amount: transactionDetails.amount,
                    transactionType: transactionDetails.type
                })
            });
            const result = await response.json();

            if(response.ok && result.success) {
                eformToken.textContent = result.token;
                sessionStorage.setItem('transactionToken', result.token);
            } else {
                eformToken.textContent = "Error generating token.";
                document.getElementById('proceedToBranch').disabled = true;
            }
        };
        generateAndDisplayToken();

        document.getElementById('proceedToBranch').addEventListener('click', () => {
            window.location.href = '/branch_verify';
        });
    }

    // --- Page: branch_verify.html ---
    const generateOtpBtn = document.getElementById('generateOtpBtn');
    if (generateOtpBtn) {
        const tokenInput = document.getElementById('tokenInput');
        const otpSection = document.getElementById('otp-section');
        const finalVerifySection = document.getElementById('final-verify-section');
        let fingerprintVerified = false;

        tokenInput.value = sessionStorage.getItem('transactionToken') || '';

        generateOtpBtn.addEventListener('click', async () => {
            const response = await fetch(`${API_URL}/api/generate_otp`, { method: 'POST' });
            const result = await response.json();
            if (result.success) {
                alert('OTP has been generated and sent (check console).');
                otpSection.style.display = 'block';
                generateOtpBtn.disabled = true;
            } else {
                alert('Failed to generate OTP.');
            }
        });

        document.getElementById('scanFingerprintBtn').addEventListener('click', () => {
            if (confirm('Simulate fingerprint scan. Do you approve?')) {
                fingerprintVerified = true;
                alert('Fingerprint verified.');
                finalVerifySection.style.display = 'block';
            } else {
                fingerprintVerified = false;
                alert('Fingerprint verification cancelled.');
            }
        });

        document.getElementById('verifyCompleteBtn').addEventListener('click', async () => {
            const token = tokenInput.value;
            const otp = document.getElementById('otpInput').value;
            const verificationResult = document.getElementById('verification-result');

            const response = await fetch(`${API_URL}/api/verify_transaction`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token, otp, fingerprintVerified })
            });

            const result = await response.json();

            verificationResult.textContent = result.message;
            if(response.ok && result.success) {
                verificationResult.className = 'alert alert-success';
                sessionStorage.clear();
            } else {
                verificationResult.className = 'alert alert-danger';
            }
            verificationResult.style.display = 'block';
        });
    }

    // --- Gemini Chatbot Logic (Shared across all pages) ---
    const openChatbotBtn = document.getElementById('open-chatbot');
    const closeChatbotBtn = document.getElementById('close-chatbot');
    const chatbotWidget = document.getElementById('chatbot-widget');
    const sendMessageBtn = document.getElementById('send-message');
    const userInput = document.getElementById('user-message');
    const chatbotMessages = document.getElementById('chatbot-messages');

    if(openChatbotBtn) {
        openChatbotBtn.addEventListener('click', () => chatbotWidget.style.display = 'flex');
        closeChatbotBtn.addEventListener('click', () => chatbotWidget.style.display = 'none');

        const addMessage = (sender, message) => {
            const messageElement = document.createElement('div');
            messageElement.classList.add('message', `${sender}-message`);
            messageElement.textContent = message;
            chatbotMessages.appendChild(messageElement);
            chatbotMessages.scrollTop = chatbotMessages.scrollHeight;
        };

        const handleSendMessage = async () => {
            const message = userInput.value.trim();
            if (!message) return;

            addMessage('user', message);
            userInput.value = '';

            try {
                const response = await fetch(`${API_URL}/api/chatbot`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ message })
                });
                const result = await response.json();
                addMessage('bot', result.reply);
            } catch (error) {
                addMessage('bot', 'Sorry, I am unable to connect. Please try again later.');
            }
        };

        sendMessageBtn.addEventListener('click', handleSendMessage);
        userInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                handleSendMessage();
            }
        });
    }
});

// --- Validation Helper Functions ---
function validateAccountNumber(accNum, bank) {
    const prefixes = { 'Canara Bank': '123', 'SBI': '456', 'Indian Bank': '789', 'Kotak Mahindra': '999' };
    const requiredPrefix = prefixes[bank];
    if (!accNum.startsWith(requiredPrefix)) {
        alert(`Invalid account number. It must start with ${requiredPrefix} for ${bank}.`);
        return false;
    }
    if(!/^\d{10,16}$/.test(accNum)){
        alert('Account number must be between 10 and 16 digits.');
        return false;
    }
    return true;
}

function validateName(name) {
    if (!/^[a-zA-Z\s]+$/.test(name)) {
        alert('Full name can only contain letters and spaces.');
        return false;
    }
    return true;
}

function validateMobile(mobile) {
    if (!/^\d{10}$/.test(mobile)) {
        alert('Mobile number must be exactly 10 digits.');
        return false;
    }
    return true;
}
