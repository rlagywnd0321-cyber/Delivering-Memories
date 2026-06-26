document.addEventListener('DOMContentLoaded', () => {
    const chatWindow = document.getElementById('chatWindow');
    const chatPhotoInput = document.getElementById('chatPhotoInput');
    const chatMsgInput = document.getElementById('chatMsgInput');
    const btnChatSend = document.getElementById('btnChatSend');
    
    const sampleBtns = document.querySelectorAll('.chat-sample-photo-btn');
    const selectedImgPreview = document.getElementById('selectedImgPreview');
    const selectedImgName = document.getElementById('selectedImgName');
    const btnClearImg = document.getElementById('btnClearImg');
    
    let selectedPhotoData = null; // Base64 또는 외부 이미지 URL 보관
    let selectedPhotoLabel = '';  // 프리뷰 이름 보관

    // 1. 파일 선택 이벤트
    chatPhotoInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                selectedPhotoData = event.target.result; // Base64 바인딩
                selectedPhotoLabel = `🖼️ 내 사진: ${file.name}`;
                updatePhotoPreview();
            };
            reader.readAsDataURL(file);
        }
    });

    // 2. 샘플 사진 선택 이벤트
    sampleBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            // 다른 활성화 제거
            sampleBtns.forEach(b => b.classList.remove('active'));
            
            const imgUrl = btn.getAttribute('data-url');
            selectedPhotoData = imgUrl;
            selectedPhotoLabel = `🖼️ 샘플 사진: ${btn.textContent.replace('샘플: ', '')}`;
            btn.classList.add('active');
            updatePhotoPreview();
        });
    });

    // 사진 프리뷰 표시 갱신
    function updatePhotoPreview() {
        if (selectedPhotoData) {
            selectedImgName.textContent = selectedPhotoLabel;
            selectedImgPreview.classList.add('active');
        } else {
            selectedImgPreview.classList.remove('active');
            sampleBtns.forEach(b => b.classList.remove('active'));
        }
    }

    // 사진 선택 취소
    btnClearImg.addEventListener('click', () => {
        selectedPhotoData = null;
        selectedPhotoLabel = '';
        chatPhotoInput.value = '';
        updatePhotoPreview();
    });

    // 3. 메시지 송신 기능
    async function sendMessage() {
        const text = chatMsgInput.value.trim();
        
        // 유효성 검사 (사진 또는 글이 있어야 함)
        if (!selectedPhotoData && text === '') {
            alert('보낼 사진이나 메시지를 입력하세요.');
            return;
        }

        // 전송 대기 상태 UI 비활성화
        btnChatSend.disabled = true;
        btnChatSend.textContent = '전송중';

        // 사용자 말풍선 추가 (우측 노란색)
        appendMineMessage(selectedPhotoData, text);
        
        // 스크롤 최하단 이동
        scrollToBottom();

        // 카카오 i 오픈빌더 스키마 모양으로 JSON 페이로드 빌드
        const requestPayload = {
            userRequest: {
                user: {
                    id: "kakao-test-user-999"
                }
            },
            action: {
                params: {
                    photo: selectedPhotoData || "",
                    letter: text,
                    recipient_name: "부모님 (가상 챗봇)",
                    recipient_postcode: "13149",
                    recipient_address: "경기 성남시 중원구 산성대로604번길 12",
                    recipient_address_detail: "1층 우편함 앞"
                }
            }
        };

        // 입력 폼 초기화
        chatMsgInput.value = '';
        selectedPhotoData = null;
        selectedPhotoLabel = '';
        chatPhotoInput.value = '';
        updatePhotoPreview();

        try {
            // 서버 스킬 API 호출
            const response = await fetch('/api/chatbot', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(requestPayload)
            });

            if (!response.ok) {
                throw new Error('서버 전송 실패');
            }

            const data = await response.json();
            
            // 챗봇 답변 렌더링 (하얀색 카카오 카드)
            appendBotResponse(data);
        } catch (err) {
            console.error(err);
            appendBotError("서버와의 통신 오류가 발생했습니다. 로컬 서버 상태를 확인하세요.");
        } finally {
            btnChatSend.disabled = false;
            btnChatSend.textContent = '전송';
            scrollToBottom();
        }
    }

    // 전송 단추 및 엔터키 리스너
    btnChatSend.addEventListener('click', sendMessage);
    chatMsgInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            sendMessage();
        }
    });

    // 4. 대화창 렌더링 함수들

    function scrollToBottom() {
        chatWindow.scrollTop = chatWindow.scrollHeight;
    }

    // 내가 보낸 노란색 말풍선 추가
    function appendMineMessage(imgData, text) {
        const msgRow = document.createElement('div');
        msgRow.className = 'msg-row mine';
        
        let bubbleContent = '';
        if (imgData) {
            // 이미지 먼저 노출
            bubbleContent += `<img src="${imgData}" class="msg-bubble-image" alt="전송 이미지">`;
        }
        if (text) {
            // 텍스트 노출
            bubbleContent += `<div>${escapeHtml(text)}</div>`;
        }

        msgRow.innerHTML = `
            <div class="msg-content-group">
                <div class="msg-bubble">${bubbleContent}</div>
            </div>
        `;
        chatWindow.appendChild(msgRow);
    }

    // 챗봇 답변 카드/말풍선 추가
    function appendBotResponse(data) {
        const msgRow = document.createElement('div');
        msgRow.className = 'msg-row bot';
        
        const outputs = data.template?.outputs || [];
        let htmlMarkup = '';

        outputs.forEach(output => {
            if (output.simpleCard) {
                // SimpleCard 렌더링
                const card = output.simpleCard;
                const thumbUrl = card.thumbnail?.imageUrl || '';
                const title = card.title || '';
                const desc = card.description || '';
                
                let btnHtml = '';
                if (card.buttons && card.buttons.length > 0) {
                    card.buttons.forEach(btn => {
                        const webLinkUrl = btn.webLinkUrl || btn.WebLinkUrl || '#';
                        const label = btn.label || btn.Label || 'Link';
                        btnHtml += `<a href="${webLinkUrl}" class="bot-card-btn" target="_blank">${escapeHtml(label)}</a>`;
                    });
                }

                htmlMarkup += `
                    <div class="bot-card">
                        ${thumbUrl ? `<div class="bot-card-thumb" style="background-image: url('${thumbUrl}')"></div>` : ''}
                        <div class="bot-card-body">
                            <div class="bot-card-title">${escapeHtml(title)}</div>
                            <div class="bot-card-desc">${escapeHtml(desc).replace(/\n/g, '<br>')}</div>
                        </div>
                        ${btnHtml}
                    </div>
                `;
            } 
            else if (output.simpleText) {
                // SimpleText 렌더링
                const text = output.simpleText.text || '';
                htmlMarkup += `<div class="msg-bubble">${escapeHtml(text).replace(/\n/g, '<br>')}</div>`;
            }
        });

        if (htmlMarkup === '') {
            htmlMarkup = `<div class="msg-bubble">알 수 없는 응답 형식입니다.</div>`;
        }

        msgRow.innerHTML = `
            <div class="msg-avatar">📮</div>
            <div class="msg-content-group">
                <div class="msg-sender">추억배달 봇</div>
                ${htmlMarkup}
            </div>
        `;
        chatWindow.appendChild(msgRow);
    }

    // 챗봇 에러 말풍선 추가
    function appendBotError(errorMsg) {
        const msgRow = document.createElement('div');
        msgRow.className = 'msg-row bot';
        msgRow.innerHTML = `
            <div class="msg-avatar">📮</div>
            <div class="msg-content-group">
                <div class="msg-sender">추억배달 봇</div>
                <div class="msg-bubble" style="background-color: #ffd2d2; color: #a80000; border-top-left-radius: 2px;">⚠️ ${escapeHtml(errorMsg)}</div>
            </div>
        `;
        chatWindow.appendChild(msgRow);
    }

    function escapeHtml(string) {
        if (!string) return '';
        const htmlEscapes = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#x27;',
            '/': '&#x2F;'
        };
        return string.replace(/[&<>"'\/]/g, match => htmlEscapes[match]);
    }
});
