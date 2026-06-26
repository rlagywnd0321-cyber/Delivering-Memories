document.addEventListener('DOMContentLoaded', () => {
    const orderTableBody = document.getElementById('orderTableBody');
    const totalCount = document.getElementById('totalCount');
    const pendingCount = document.getElementById('pendingCount');
    const completedCount = document.getElementById('completedCount');
    
    const btnExportCSV = document.getElementById('btnExportCSV');
    
    // 모달 및 미리보기 컨트롤 요소 선택
    const imageModal = document.getElementById('imageModal');
    const btnCloseImageModal = document.getElementById('btnCloseImageModal');
    const modalFrontPreview = document.getElementById('modalFrontPreview');
    const modalLetterPreview = document.getElementById('modalLetterPreview');
    const btnDownloadPDF = document.getElementById('btnDownloadPDF');
    const btnDownloadFrontPNG = document.getElementById('btnDownloadFrontPNG');
    const btnDownloadBackPNG = document.getElementById('btnDownloadBackPNG');
    const modalLoadingOverlay = document.getElementById('modalLoadingOverlay');
    const modalLoadingText = document.getElementById('modalLoadingText');
    const btnPrevPhoto = document.getElementById('btnPrevPhoto');
    const btnNextPhoto = document.getElementById('btnNextPhoto');
    const photoIndexBadge = document.getElementById('photoIndexBadge');
    
    // 오프스크린 인쇄 전용 템플릿 요소 선택
    const printFront = document.getElementById('printFront');
    const printBack = document.getElementById('printBack');
    const printLetter = document.getElementById('printLetter');
    
    let postcardsData = [];
    let currentActiveOrder = null; // 현재 상세 모달에 로드된 주문 데이터
    let currentPhotoIndex = 0;
    let currentPhotoUrls = [];

    // 1. 서버로부터 엽서 주문 데이터 가져오기
    function fetchOrders() {
        fetch('/api/postcards')
            .then(res => res.json())
            .then(data => {
                if (data.success) {
                    let orders = data.data;
                    if (orders && !Array.isArray(orders) && Array.isArray(orders.value)) {
                        orders = orders.value;
                    }
                    postcardsData = orders || [];
                    
                    renderTable(postcardsData);
                    updateSummary(postcardsData);
                } else {
                    orderTableBody.innerHTML = `<tr><td colspan="10" class="text-center py-4 text-accent">데이터를 불러오지 못했습니다: ${data.error}</td></tr>`;
                }
            })
            .catch(err => {
                console.error('Failed to load orders:', err);
                orderTableBody.innerHTML = `<tr><td colspan="10" class="text-center py-4 text-accent">서버 연결 실패. 백엔드가 실행 중인지 확인하세요.</td></tr>`;
            });
    }

    // 2. 주문 요약 정보 업데이트
    function updateSummary(orders) {
        totalCount.textContent = `${orders.length}건`;
        
        let completed = 0;
        orders.forEach(order => {
            if (localStorage.getItem(`status_${order.id}`) === 'completed') {
                completed++;
            }
        });
        
        completedCount.textContent = `${completed}건`;
        pendingCount.textContent = `${orders.length - completed}건`;
    }

    // 3. 테이블에 주문 렌더링
    function renderTable(orders) {
        if (orders.length === 0) {
            orderTableBody.innerHTML = `<tr><td colspan="10" class="text-center py-4">접수된 엽서 배달 신청이 없습니다.</td></tr>`;
            return;
        }

        orderTableBody.innerHTML = '';
        orders.forEach(order => {
            const tr = document.createElement('tr');
            
            // 날짜 보기 좋게 가공
            const date = new Date(order.created_at);
            const dateString = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
            
            // 발송 상태 읽기
            const isCompleted = localStorage.getItem(`status_${order.id}`) === 'completed';
            const statusBadge = isCompleted 
                ? '<span class="badge badge-success">발송 완료</span>' 
                : '<span class="badge badge-pending">배송 대기</span>';
            const statusBtnText = isCompleted ? '대기 전환' : '발송 완료';

            // 다중 이미지 및 썸네일 대응
            const photoUrls = order.photo_urls || (order.photo_url ? [order.photo_url] : []);
            const firstPhoto = photoUrls.length > 0 ? photoUrls[0] : '';
            const multiBadge = photoUrls.length > 1 ? `<div class="thumb-multi-badge">+ ${photoUrls.length}장</div>` : '';
            const imageCountText = photoUrls.length > 1 ? `<div style="font-size:11px;color:var(--primary);margin-top:2px;">(총 ${photoUrls.length}장 묶음)</div>` : '';

            tr.innerHTML = `
                <td class="font-mono text-small">${order.id}</td>
                <td>${dateString}</td>
                <td class="text-muted">가족 회원</td>
                <td class="font-bold">${escapeHtml(order.recipient_name)}</td>
                <td class="font-mono">${escapeHtml(order.recipient_postcode)}</td>
                <td class="text-left font-semibold">${escapeHtml(order.recipient_address)}</td>
                <td class="text-left">${escapeHtml(order.recipient_address_detail)}</td>
                <td class="text-left letter-cell" title="${escapeHtml(order.letter_content)}">${escapeHtml(order.letter_content)}${imageCountText}</td>
                <td>
                    <div class="table-thumb-wrapper" style="position: relative;">
                        <img src="${firstPhoto}" class="table-thumb" alt="썸네일">
                        ${multiBadge}
                    </div>
                </td>
                <td>
                    <div class="table-actions">
                        ${statusBadge}
                        <button type="button" class="btn-table-action btn-toggle-status" data-id="${order.id}">${statusBtnText}</button>
                        <button type="button" class="btn-table-action btn-print-view" data-id="${order.id}">🖨️ 인쇄용 보기</button>
                    </div>
                </td>
            `;

            // 공통 상세 모달 오픈 로직
            const openModal = () => {
                currentActiveOrder = order;
                currentPhotoUrls = order.photo_urls || (order.photo_url ? [order.photo_url] : []);
                currentPhotoIndex = 0;
                
                updateModalPhoto();
                modalLetterPreview.innerHTML = order.letter_content ? order.letter_content.replace(/\n/g, '<br>') : '';
                imageModal.classList.add('active');
            };

            // 썸네일 클릭 시 상세 팝업 오픈
            tr.querySelector('.table-thumb').addEventListener('click', openModal);
            // 인쇄용 보기 버튼 클릭 시 상세 팝업 오픈
            tr.querySelector('.btn-print-view').addEventListener('click', openModal);

            // 상태 변경 토글 버튼 리스너
            const toggleBtn = tr.querySelector('.btn-toggle-status');
            toggleBtn.addEventListener('click', () => {
                const currentStatus = localStorage.getItem(`status_${order.id}`);
                if (currentStatus === 'completed') {
                    localStorage.removeItem(`status_${order.id}`);
                } else {
                    localStorage.setItem(`status_${order.id}`, 'completed');
                }
                fetchOrders();
            });

            orderTableBody.appendChild(tr);
        });
    }

    // 모달 활성화된 갤러리 이미지 업데이트 로직
    function updateModalPhoto() {
        const photoUrl = currentPhotoUrls[currentPhotoIndex] || '';
        modalFrontPreview.style.backgroundImage = `url('${photoUrl}')`;
        
        if (currentPhotoUrls.length > 1) {
            btnPrevPhoto.style.display = 'block';
            btnNextPhoto.style.display = 'block';
            photoIndexBadge.style.display = 'block';
            photoIndexBadge.textContent = `${currentPhotoIndex + 1} / ${currentPhotoUrls.length}`;
        } else {
            btnPrevPhoto.style.display = 'none';
            btnNextPhoto.style.display = 'none';
            photoIndexBadge.style.display = 'none';
        }
    }

    // 모달 내부 갤러리 화살표 이벤트 바인딩
    btnPrevPhoto.addEventListener('click', (e) => {
        e.stopPropagation();
        if (currentPhotoUrls.length <= 1) return;
        currentPhotoIndex = (currentPhotoIndex - 1 + currentPhotoUrls.length) % currentPhotoUrls.length;
        updateModalPhoto();
    });

    btnNextPhoto.addEventListener('click', (e) => {
        e.stopPropagation();
        if (currentPhotoUrls.length <= 1) return;
        currentPhotoIndex = (currentPhotoIndex + 1) % currentPhotoUrls.length;
        updateModalPhoto();
    });

    // HTML 이스케이프 헬퍼 (XSS 방지)
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

    // 4. 배송 주소록 CSV 엑셀 내보내기 기능
    btnExportCSV.addEventListener('click', () => {
        if (postcardsData.length === 0) {
            alert('다운로드할 주문 데이터가 없습니다.');
            return;
        }

        let csvContent = '주문번호,신청일시,수신인성함,우편번호,기본주소,상세주소,편지내용\n';

        postcardsData.forEach(order => {
            const cleanLetter = order.letter_content 
                ? `"${order.letter_content.replace(/"/g, '""').replace(/\n/g, ' ')}"`
                : '""';
            const cleanName = `"${order.recipient_name.replace(/"/g, '""')}"`;
            const cleanAddr = `"${order.recipient_address.replace(/"/g, '""')}"`;
            const cleanDetail = `"${order.recipient_address_detail.replace(/"/g, '""')}"`;
            
            const date = new Date(order.created_at);
            const dateString = `${date.getFullYear()}-${date.getMonth()+1}-${date.getDate()}`;

            csvContent += `${order.id},${dateString},${cleanName},'${order.recipient_postcode},${cleanAddr},${cleanDetail},${cleanLetter}\n`;
        });

        const BOM = '\uFEFF';
        const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
        
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `postcards_address_${new Date().toISOString().slice(0,10)}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setTimeout(() => URL.revokeObjectURL(url), 200);
    });

    // 5. 고해상도 인쇄용 렌더링 & 다운로드 헬퍼 로직

    function showLoading(text) {
        modalLoadingText.textContent = text;
        modalLoadingOverlay.classList.add('active');
    }

    function hideLoading() {
        modalLoadingOverlay.classList.remove('active');
    }

    // 인쇄용 숨김 템플릿 DOM 데이터 바인딩
    function preparePrintTemplate(order, photoUrl) {
        printFront.style.backgroundImage = `url('${photoUrl}')`;
        printLetter.innerHTML = order.letter_content ? order.letter_content.replace(/\n/g, '<br>') : '';
    }

    // 폰트/이미지 로드 완료 대기 및 html2canvas 기반 1800x1200 렌더링
    async function captureElement(element) {
        await document.fonts.ready; // 웹 폰트 로드 완료 시점 보장
        
        // 브라우저 리소스 바인딩 딜레이
        await new Promise(resolve => setTimeout(resolve, 400));
        
        const canvas = await html2canvas(element, {
            width: 1800,
            height: 1200,
            scale: 1,
            useCORS: true,
            logging: false,
            backgroundColor: null
        });
        return canvas;
    }

    // PNG 다운로드 트리거
    async function downloadPNG(element, filename, photoUrl) {
        try {
            showLoading("고화질 PNG 이미지 생성 중...");
            preparePrintTemplate(currentActiveOrder, photoUrl);
            
            const canvas = await captureElement(element);
            
            if (canvas.toBlob) {
                canvas.toBlob((blob) => {
                    if (!blob) {
                        alert('이미지 생성에 실패했습니다.');
                        hideLoading();
                        return;
                    }
                    const url = URL.createObjectURL(blob);
                    const link = document.createElement('a');
                    link.download = filename;
                    link.href = url;
                    link.style.display = 'none';
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                    setTimeout(() => URL.revokeObjectURL(url), 200);
                    hideLoading();
                }, 'image/png');
            } else {
                const url = canvas.toDataURL("image/png");
                const link = document.createElement('a');
                link.download = filename;
                link.href = url;
                link.style.display = 'none';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                hideLoading();
            }
        } catch (err) {
            console.error('Failed to capture PNG:', err);
            alert('이미지 생성 도중 오류가 발생했습니다: ' + err.message);
            hideLoading();
        }
    }

    // PNG 다운로드 버튼 리스너 (현재 선택된 갤러리 썸네일 기준 작동)
    btnDownloadFrontPNG.addEventListener('click', () => {
        if (!currentActiveOrder || currentPhotoUrls.length === 0) return;
        const currentPhoto = currentPhotoUrls[currentPhotoIndex];
        downloadPNG(printFront, `postcard_front_${currentActiveOrder.id}_${currentPhotoIndex + 1}.png`, currentPhoto);
    });

    btnDownloadBackPNG.addEventListener('click', () => {
        if (!currentActiveOrder || currentPhotoUrls.length === 0) return;
        const currentPhoto = currentPhotoUrls[currentPhotoIndex];
        downloadPNG(printBack, `postcard_back_${currentActiveOrder.id}_${currentPhotoIndex + 1}.png`, currentPhoto);
    });

    // 6. jsPDF 기반 150x100mm 양면 PDF 다운로드 구현 (묶음 이미지 전체 결합)
    btnDownloadPDF.addEventListener('click', async () => {
        if (!currentActiveOrder || currentPhotoUrls.length === 0) return;
        
        try {
            showLoading("실물 인쇄 규격 양면 PDF 생성 중...");
            
            // jsPDF 인스턴스 생성 (150x100mm 규격 가로형)
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF({
                orientation: 'landscape',
                unit: 'mm',
                format: [150, 100]
            });

            // 묶음 전송된 사진 수만큼 돌면서 앞면-뒷면 교차 배치 렌더링
            for (let i = 0; i < currentPhotoUrls.length; i++) {
                const photoUrl = currentPhotoUrls[i];
                preparePrintTemplate(currentActiveOrder, photoUrl);
                
                // 앞면(사진) 렌더링
                const canvasFront = await captureElement(printFront);
                const imgDataFront = canvasFront.toDataURL("image/jpeg", 0.95);
                
                // 뒷면(편지글) 렌더링
                const canvasBack = await captureElement(printBack);
                const imgDataBack = canvasBack.toDataURL("image/jpeg", 0.95);
                
                // 첫 장이 아니면 페이지 추가
                if (i > 0) {
                    doc.addPage([150, 100], 'landscape');
                }
                // 앞면(사진) 배치
                doc.addImage(imgDataFront, 'JPEG', 0, 0, 150, 100);
                
                // 뒷면(편지글) 배치
                doc.addPage([150, 100], 'landscape');
                doc.addImage(imgDataBack, 'JPEG', 0, 0, 150, 100);
            }
            
            // jsPDF 내장 저장 메소드 호출로 호환성 극대화 (한글 파일명 깨짐 방지 위해 영문 조합 권장)
            const safeFileName = `postcard_print_${currentActiveOrder.id}.pdf`;
            doc.save(safeFileName);
        } catch (err) {
            console.error('Failed to generate PDF:', err);
            alert('PDF 생성 도중 오류가 발생했습니다: ' + err.message);
        } finally {
            hideLoading();
        }
    });

    // 7. 모달 닫기 제어
    btnCloseImageModal.addEventListener('click', () => {
        imageModal.classList.remove('active');
        currentActiveOrder = null;
    });
    
    imageModal.addEventListener('click', (e) => {
        if (e.target === imageModal) {
            imageModal.classList.remove('active');
            currentActiveOrder = null;
        }
    });

    // 초기화 실행
    fetchOrders();
});
