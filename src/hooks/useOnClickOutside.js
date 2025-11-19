import { useEffect, useRef, useState } from 'react'

const useOnClickOutside = (initialValue) => {
	const [isShow, setIsShow] = useState(initialValue)
	const ref = useRef()

	useEffect(() => {
		const handleClick = (event) => {
			if (ref.current && !ref.current.contains(event.target)) {
				setIsShow(false)
			}
		}

		document.addEventListener('mousedown', handleClick)
		
		return () => {
			document.removeEventListener('mousedown', handleClick)
		}
	}, [])

	return { isShow, ref, setIsShow } // ← ВОЗВРАЩАЕМ setIsShow!
}

export default useOnClickOutside