/**
 * Đặt lại vị trí cuộn của khung nội dung sau khi quay lại một trang.
 *
 * Next App Router tự `scrollIntoView()` phân đoạn vừa mount ở `componentDidMount` của
 * layout-router, chạy SAU layout effect của trang. Khi đầu trang đã cuộn khỏi màn hình,
 * nó kéo khung cuộn lên đầu và ghi đè vị trí vừa khôi phục. Vì vậy đặt ngay rồi đặt lại
 * ở các khung hình kế tiếp; dừng sớm nếu người dùng đã tự cuộn.
 */
export function restorePaneScroll(paneId: string, top: number): () => void {
    const pane = document.getElementById(paneId);
    if (!pane) return () => undefined;

    let cancelled = false;
    let frames = 0;
    let frame = 0;
    const stop = (): void => {
        cancelled = true;
        window.cancelAnimationFrame(frame);
        pane.removeEventListener("wheel", stop);
        pane.removeEventListener("touchstart", stop);
        pane.removeEventListener("keydown", stop);
        pane.removeEventListener("pointerdown", stop);
    };
    const apply = (): void => {
        if (cancelled) return;
        if (Math.abs(pane.scrollTop - top) > 1) pane.scrollTop = top;
        frames += 1;
        if (frames < 8) frame = window.requestAnimationFrame(apply);
        else stop();
    };

    pane.addEventListener("wheel", stop, { passive: true });
    pane.addEventListener("touchstart", stop, { passive: true });
    pane.addEventListener("keydown", stop);
    pane.addEventListener("pointerdown", stop);
    pane.scrollTop = top;
    frame = window.requestAnimationFrame(apply);
    return stop;
}
