document.addEventListener('DOMContentLoaded', () => {
    // DOM 요소 선택
    const postcard = document.getElementById('postcard');
    const btnFlip = document.getElementById('btnFlip');
    const photoInput = document.getElementById('photoInput');
    const photoFrame = document.getElementById('photoFrame');
    const sampleBtns = document.querySelectorAll('.sample-btn');
    
    const letterInput = document.getElementById('letterInput');
    const letterPreview = document.getElementById('letterPreview');
    
    const recipientName = document.getElementById('recipientName');
    const recipientAddress = document.getElementById('recipientAddress');
    const recipientAddressDetail = document.getElementById('recipientAddressDetail');
    const postcode = document.getElementById('postcode');
    const btnSearchAddress = document.getElementById('btnSearchAddress');
    
    const namePreview = document.getElementById('namePreview');
    const addressPreview = document.getElementById('addressPreview');
    const postcodePreview = document.getElementById('postcodePreview');
    
    const postcardForm = document.getElementById('postcardForm');
    const modalOverlay = document.getElementById('modalOverlay');
    const btnClose = document.getElementById('btnClose');
    
    // 업로드할 사진 데이터(Base64 또는 외부 이미지 URL) 보관용 전역 변수
    let selectedPhotoBase64 = null;

    // 0. 로컬 스토리지에서 저장된 배송 정보 불러오기
    function loadSavedAddress() {
        const savedName = localStorage.getItem('recipient_name');
        const savedPostcode = localStorage.getItem('recipient_postcode');
        const savedAddress = localStorage.getItem('recipient_address');
        const savedAddressDetail = localStorage.getItem('recipient_address_detail');

        if (savedName) {
            recipientName.value = savedName;
            namePreview.textContent = savedName + ' 귀하';
        }
        if (savedPostcode) {
            postcode.value = savedPostcode;
        }
        if (savedAddress) {
            recipientAddress.value = savedAddress;
        }
        if (savedAddressDetail) {
            recipientAddressDetail.value = savedAddressDetail;
        }
        
        // 주소 및 우편번호 프리뷰 갱신
        updateAddressPreview();
    }

    // 초기 로드 시 실행
    loadSavedAddress();

    // 1. 엽서 3D 뒤집기 제어
    btnFlip.addEventListener('click', () => {
        postcard.classList.toggle('is-flipped');
    });

    // 2. 사진 파일 업로드 처리
    photoInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                selectedPhotoBase64 = event.target.result; // Base64 Data URL을 전역 변수에 바인딩
                setPostcardImage(event.target.result);
            };
            reader.readAsDataURL(file);
        } else {
            // 파일 선택을 취소하거나 파일이 없으면 사진 정보 초기화
            selectedPhotoBase64 = null;
            photoFrame.style.backgroundImage = '';
            const placeholder = photoFrame.querySelector('.placeholder-content');
            if (placeholder) {
                placeholder.style.display = 'block';
            }
        }
    });

    // 3. 샘플 이미지 버튼 클릭 처리
    sampleBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const imgUrl = btn.getAttribute('data-img');
            selectedPhotoBase64 = imgUrl; // 외부 샘플 URL을 전역 변수에 바인딩
            setPostcardImage(imgUrl);
        });
    });

    // 엽서 이미지 설정 함수
    function setPostcardImage(src) {
        // 이미지가 설정되면 플레이스홀더 내용을 숨김
        const placeholder = photoFrame.querySelector('.placeholder-content');
        if (placeholder) {
            placeholder.style.display = 'none';
        }
        photoFrame.style.backgroundImage = `url('${src}')`;
        
        // 사진을 등록하면 사용자에게 앞면을 보여주기 위해 뒤집기 해제
        if (postcard.classList.contains('is-flipped')) {
            postcard.classList.remove('is-flipped');
        }

        // 백엔드로 전송할 이미지 데이터(Base64 또는 외부 주소 URL)를 전역 변수에 바인딩
        selectedPhotoBase64 = src;
    }

    // 4. 편지글 실시간 미러링 및 자동 뒤집기
    const defaultLetterHtml = `사랑하는 엄마 아빠에게,<br><br>여기에 편지 내용을 입력하시면<br>정갈한 손글씨체로 실시간 변경되어<br>엽서 뒷면에 예쁘게 인쇄됩니다.`;

    letterInput.addEventListener('input', (e) => {
        const text = e.target.value;
        
        // 사용자가 편지를 쓰기 시작하면 자동으로 엽서 뒷면이 보이게 회전시킴
        if (!postcard.classList.contains('is-flipped')) {
            postcard.classList.add('is-flipped');
        }

        if (text.trim() === '') {
            letterPreview.innerHTML = defaultLetterHtml;
        } else {
            // 줄바꿈 문자(\n)를 HTML <br>로 변환하여 렌더링
            letterPreview.innerHTML = text.replace(/\n/g, '<br>');
        }
    });

    // 5. 받는 사람 정보 실시간 미러링
    recipientName.addEventListener('input', (e) => {
        const name = e.target.value;
        // 주소 작성 시에도 뒷면이 보여야 하므로 자동 회전
        if (!postcard.classList.contains('is-flipped')) {
            postcard.classList.add('is-flipped');
        }

        if (name.trim() === '') {
            namePreview.textContent = '부모님 귀하';
        } else {
            namePreview.textContent = name + ' 귀하';
        }
    });

    // 5-1. 주소 및 우편번호 프리뷰 업데이트 함수
    function updateAddressPreview() {
        const baseAddr = recipientAddress.value.trim();
        const detailAddr = recipientAddressDetail.value.trim();
        const code = postcode.value.trim();

        // 엽서 주소 프리뷰 텍스트 설정
        if (baseAddr === '' && detailAddr === '') {
            addressPreview.textContent = '부모님 댁 우편함 주소';
        } else {
            addressPreview.textContent = `${baseAddr} ${detailAddr}`;
        }

        // 우편번호 5자리 박스들 설정
        const codeChars = code.padStart(5, ' ').split(''); // 5자리가 안 되면 공백 패딩
        const spans = postcodePreview.querySelectorAll('span');
        spans.forEach((span, index) => {
            if (codeChars[index]) {
                span.textContent = codeChars[index];
            } else {
                span.textContent = '';
            }
        });
    }

    // 5-2. 상세 주소 입력 시 프리뷰 실시간 반영
    recipientAddressDetail.addEventListener('input', () => {
        if (!postcard.classList.contains('is-flipped')) {
            postcard.classList.add('is-flipped');
        }
        updateAddressPreview();
    });

    // 5-3. 다음/카카오 주소 검색 서비스 실행
    btnSearchAddress.addEventListener('click', () => {
        if (!postcard.classList.contains('is-flipped')) {
            postcard.classList.add('is-flipped');
        }

        new daum.Postcode({
            oncomplete: function(data) {
                let addr = ''; // 주소 변수
                
                // 사용자가 선택한 주소 타입에 따라 주소 값 가져옴
                if (data.userSelectedType === 'R') {
                    addr = data.roadAddress;
                } else {
                    addr = data.jibunAddress;
                }

                // 우편번호와 기본 주소를 폼에 바인딩
                postcode.value = data.zonecode;
                recipientAddress.value = addr;
                
                // 상세주소 입력창 초기화 후 포커싱
                recipientAddressDetail.value = '';
                recipientAddressDetail.focus();
                
                // 프리뷰 업데이트
                updateAddressPreview();
            }
        }).open();
    });

    // 6. 엽서 배송 신청 (백엔드 API 전송 및 발송 애니메이션 연동)
    postcardForm.addEventListener('submit', (e) => {
        e.preventDefault(); // 실제 폼 제출 중단

        // 간단한 유효성 검사 (사진 등록 여부 확인)
        if (!selectedPhotoBase64 || selectedPhotoBase64.trim() === '') {
            alert('부모님께 보낼 사진을 먼저 등록해 주세요!');
            // 엽서 앞면으로 회전
            if (postcard.classList.contains('is-flipped')) {
                postcard.classList.remove('is-flipped');
            }
            return;
        }

        const btnSubmit = document.getElementById('btnSubmit');
        btnSubmit.disabled = true;
        btnSubmit.textContent = '📮 배송 신청 전송 중...';

        // JSON 데이터 객체 빌드 (Base64 사진 포함)
        const requestData = {
            photo_data: selectedPhotoBase64,
            recipient_name: recipientName.value,
            recipient_postcode: postcode.value,
            recipient_address: recipientAddress.value,
            recipient_address_detail: recipientAddressDetail.value,
            letter_content: letterInput.value
        };

        // 백엔드 API 서버로 전송 (포트 통합을 위해 상대경로 호출)
        fetch('/api/postcard', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestData)
        })
        .then(response => {
            if (!response.ok) {
                return response.json().then(err => { throw new Error(err.error || '전송 실패'); });
            }
            return response.json();
        })
        .then(data => {
            console.log('Postcard send success:', data);
            
            // 입력된 배송 정보를 로컬 스토리지에 저장 (다음 발송 시 자동완성)
            localStorage.setItem('recipient_name', recipientName.value);
            localStorage.setItem('recipient_postcode', postcode.value);
            localStorage.setItem('recipient_address', recipientAddress.value);
            localStorage.setItem('recipient_address_detail', recipientAddressDetail.value);

            // 전송 완료 상태 변수 리셋
            selectedPhotoBase64 = null;

            // 모달창 활성화 및 애니메이션 시작
            modalOverlay.classList.add('active');
        })
        .catch(err => {
            console.error('Submission failed:', err);
            alert('배송 신청 전송에 실패했습니다: ' + err.message);
        })
        .finally(() => {
            btnSubmit.disabled = false;
            btnSubmit.textContent = '📮 우편함으로 배달 신청하기';
        });
    });

    // 7. 성공 모달창 닫기 및 폼 리셋
    btnClose.addEventListener('click', () => {
        modalOverlay.classList.remove('active');
        
        // 폼 리셋 및 엽서 이미지/편지내용 초기화
        postcardForm.reset();
        photoFrame.style.backgroundImage = '';
        const placeholder = photoFrame.querySelector('.placeholder-content');
        if (placeholder) {
            placeholder.style.display = 'block';
        }
        letterPreview.innerHTML = defaultLetterHtml;
        
        // 배송 정보는 저장되어 있는 정보를 다시 불러와 채워줌 (매번 입력하지 않음)
        loadSavedAddress();
        
        // 앞면으로 뒤집기
        if (postcard.classList.contains('is-flipped')) {
            postcard.classList.remove('is-flipped');
        }
    });
});
