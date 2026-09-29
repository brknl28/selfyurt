//go:build windows

package docker

import (
	"syscall"
	"unsafe"
)

var (
	modkernel32            = syscall.NewLazyDLL("kernel32.dll")
	procGetDiskFreeSpaceEx = modkernel32.NewProc("GetDiskFreeSpaceExW")
)

func diskUsagePercent(path string) (float64, error) {
	var freeBytesAvailable, totalNumberOfBytes, totalNumberOfFreeBytes int64

	p, err := syscall.UTF16PtrFromString(path)
	if err != nil {
		return 0, err
	}

	ret, _, err := procGetDiskFreeSpaceEx.Call(
		uintptr(unsafe.Pointer(p)),
		uintptr(unsafe.Pointer(&freeBytesAvailable)),
		uintptr(unsafe.Pointer(&totalNumberOfBytes)),
		uintptr(unsafe.Pointer(&totalNumberOfFreeBytes)),
	)
	if ret == 0 {
		p, _ = syscall.UTF16PtrFromString("C:\\")
		ret, _, err = procGetDiskFreeSpaceEx.Call(
			uintptr(unsafe.Pointer(p)),
			uintptr(unsafe.Pointer(&freeBytesAvailable)),
			uintptr(unsafe.Pointer(&totalNumberOfBytes)),
			uintptr(unsafe.Pointer(&totalNumberOfFreeBytes)),
		)
		if ret == 0 {
			return 0, err
		}
	}

	if totalNumberOfBytes == 0 {
		return 0, nil
	}

	used := totalNumberOfBytes - totalNumberOfFreeBytes
	return (float64(used) / float64(totalNumberOfBytes)) * 100, nil
}
