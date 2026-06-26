document.addEventListener('DOMContentLoaded', () => {
    // 1. URL 쿼리 파라미터에서 user_id 추출
    const urlParams = new URLSearchParams(window.location.search);
    const userId = urlParams.get('user_id') || 'kakao-test-user-999';
    
    // UI 요소
    const userIdDisplay = document.getElementById('userIdDisplay');
    const galleryGrid = document.getElementById('galleryGrid');
    const galleryEmpty = document.getElementById('galleryEmpty');
    const selectCounter = document.getElementById('selectCounter');
    
    // 폼 요소
    const recipientName = document.getElementById('recipientName');
    const postcode = document.getElementById('postcode');
    const recipientAddress = document.getElementById('recipientAddress');
    const recipientAddressDetail = document.getElementById('recipientAddressDetail');
    const letterContent = document.getElementById('letterContent');
    const btnConfirmSubmit = document.getElementById('btnConfirmSubmit');
    
    // 성공 모달 요소
    const successModal = document.getElementById('successModal');
    const modalDetailText = document.getElementById('modalDetailText');
    const btnModalClose = document.getElementById('btnModalClose');

    // 선택된 사진 URL들을 담을 셋(Set)
    let selectedPhotos = new Set();
    let allGalleryItems = [];

    // 사용자 ID 표시
    userIdDisplay.textContent = userId;

    // 2. LocalStorage에서 이전 배송지 정보 로드 (자동완성)
    if (localStorage.getItem('recipient_name')) {
        recipientName.value = localStorage.getItem('recipient_name');
    }
    if (localStorage.getItem('recipient_postcode')) {
        postcode.value = localStorage.getItem('recipient_postcode');
    }
    if (localStorage.getItem('recipient_address')) {
        recipientAddress.value = localStorage.getItem('recipient_address');
    }
    if (localStorage.getItem('recipient_address_detail')) {
        recipientAddressDetail.value = localStorage.getItem('recipient_address_detail');
    }

    // 3. 갤러리 이미지 조회 API 호출
    async function loadGallery() {
        try {
            const response = await fetch(`/api/chatbot/gallery?user_id=${encodeURIComponent(userId)}`);
            if (!response.ok) {
                throw new Error('갤러리 조회 실패');
            }
            const resObj = await response.json();
            allGalleryItems = resObj.data || [];
            if (allGalleryItems && !Array.isArray(allGalleryItems)) {
                allGalleryItems = [allGalleryItems];
            }
            renderGallery();
        } catch (err) {
            console.error(err);
            galleryEmpty.textContent = '❌ 사진을 불러오는 중 오류가 발생했습니다. 로컬 서버 상태를 점검하세요.';
            galleryEmpty.style.display = 'block';
        }
    }

    // 4. 갤러리 렌더링 및 이벤트 추가
    function renderGallery() {
        galleryGrid.innerHTML = '';
        
        if (allGalleryItems.length === 0) {
            galleryEmpty.style.display = 'block';
            btnConfirmSubmit.disabled = true;
            return;
        }
        
        galleryEmpty.style.display = 'none';
        
        allGalleryItems.forEach(item => {
            const card = document.createElement('div');
            card.className = 'gallery-card';
            card.setAttribute('data-url', item.photo_url);
            
            // 날짜 포맷팅 (YYYY-MM-DD)
            const dateStr = item.created_at ? item.created_at.substring(0, 10) : '';
            const descriptionText = item.letter_content || '사진 전송';
            
            card.innerHTML = `
                <div class="card-thumb" style="background-image: url('${item.photo_url}')"></div>
                <div class="check-overlay">
                    <span class="check-icon">✓</span>
                </div>
                <div class="card-info">
                    <div class="card-date">${dateStr}</div>
                    <div class="card-desc">${escapeHtml(descriptionText)}</div>
                </div>
            `;
            
            // 클릭 시 토글 선택
            card.addEventListener('click', () => {
                const photoUrl = item.photo_url;
                
                if (selectedPhotos.has(photoUrl)) {
                    // 선택 취소
                    selectedPhotos.delete(photoUrl);
                    card.classList.remove('selected');
                } else {
                    // 신규 선택 (최대 10장 제한 체크)
                    if (selectedPhotos.size >= 10) {
                        alert('엽서 묶음 배송은 한번에 최대 10장까지 선택할 수 있습니다.');
                        return;
                    }
                    selectedPhotos.add(photoUrl);
                    card.classList.add('selected');
                }
                
                updateCounterAndState();
            });
            
            galleryGrid.appendChild(card);
        });
    }

    // 5. 카운터 및 발송 버튼 활성화 상태 업데이트
    function updateCounterAndState() {
        selectCounter.textContent = `${selectedPhotos.size} / 10장 선택됨`;
        
        // 폼 유효성 검사
        const isPhotoSelected = selectedPhotos.size > 0;
        const isNameFilled = recipientName.value.trim() !== '';
        const isAddressFilled = recipientAddress.value.trim() !== '';
        
        // 필수 값 입력 및 사진 선택이 완료되면 발송 버튼 활성화
        btnConfirmSubmit.disabled = !(isPhotoSelected && isNameFilled && isAddressFilled);
    }

    // 폼 인풋 변경 이벤트 리스너 등록
    [recipientName, recipientAddress, postcode, recipientAddressDetail].forEach(input => {
        input.addEventListener('input', updateCounterAndState);
    });

    // 6. 최종 배송 신청 확정 전송 (POST)
    btnConfirmSubmit.addEventListener('click', async () => {
        const name = recipientName.value.trim();
        const code = postcode.value.trim();
        const addr = recipientAddress.value.trim();
        const addrDetail = recipientAddressDetail.value.trim();
        const text = letterContent.value.trim();
        
        if (selectedPhotos.size === 0) {
            alert('보낼 엽서 사진을 선택하세요.');
            return;
        }
        if (!name || !addr) {
            alert('받는 사람 이름과 기본 주소는 필수 입력 사항입니다.');
            return;
        }

        btnConfirmSubmit.disabled = true;
        btnConfirmSubmit.innerHTML = '<span>📮 최종 접수 전송 중...</span>';

        const requestPayload = {
            user_id: userId,
            photo_urls: Array.from(selectedPhotos),
            recipient_name: name,
            recipient_postcode: code,
            recipient_address: addr,
            recipient_address_detail: addrDetail,
            letter_content: text
        };

        try {
            const response = await fetch('/api/postcard/confirm', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(requestPayload)
            });

            if (!response.ok) {
                throw new Error('최종 발송 등록 실패');
            }

            const data = await response.json();
            console.log('Postcard confirm success:', data);

            // 배송지 정보 로컬스토리지 저장
            localStorage.setItem('recipient_name', name);
            localStorage.setItem('recipient_postcode', code);
            localStorage.setItem('recipient_address', addr);
            localStorage.setItem('recipient_address_detail', addrDetail);

            // 모달 정보 갱신 및 활성화
            modalDetailText.textContent = `선택하신 사진 ${selectedPhotos.size}장이 정성스레 제작되어 부모님 댁 우편함으로 배달 신청되었습니다.`;
            successModal.classList.add('active');

            // 폼 및 선택 리셋
            selectedPhotos.clear();
            letterContent.value = '';
            document.querySelectorAll('.gallery-card.selected').forEach(card => {
                card.classList.remove('selected');
            });
            updateCounterAndState();

        } catch (err) {
            console.error(err);
            alert('배송 신청 확정 중 오류가 발생했습니다: ' + err.message);
        } finally {
            btnConfirmSubmit.disabled = false;
            btnConfirmSubmit.innerHTML = '<span>📮 엽서 배송 최종 신청하기</span>';
        }
    });

    // 7. 모달 닫기
    btnModalClose.addEventListener('click', () => {
        successModal.classList.remove('active');
    });

    // 헬퍼: HTML escape
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

    // 초기 로딩 실행
    loadGallery();
});
