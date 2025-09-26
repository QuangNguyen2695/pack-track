# 🎯 Thêm Minimize/Hide Button cho Sync Widget

## ✅ Hoàn thành:

### 1. **Thêm State Management:**
```typescript
isMinimized = false; // State để quản lý minimize

onToggleMinimize(): void {
  this.isMinimized = !this.isMinimized;
}
```

### 2. **Cập nhật Template với Animation:**

**Header với 2 buttons:**
```html
<div class="flex items-center gap-1">
  <!-- Minimize button (dấu -) -->
  <ion-button fill="clear" size="small" (click)="onToggleMinimize()" class="minimize-btn">
    <ion-icon name="remove" slot="icon-only"></ion-icon>
  </ion-button>
  
  <!-- Close button (dấu x) -->
  <ion-button fill="clear" size="small" (click)="onClose()" class="close-btn">
    <ion-icon name="close" slot="icon-only"></ion-icon>
  </ion-button>
</div>
```

**Clickable Icon khi minimized:**
```html
<ion-icon 
  [name]="getStatusIcon()" 
  [class.spinning]="progress.isActive"
  (click)="isMinimized && onToggleMinimize()"
  [class]="isMinimized ? 'cursor-pointer' : ''"
></ion-icon>
```

### 3. **Smooth Animation với Tailwind CSS:**

**Widget Container:**
```html
<div class="sync-widget transition-all duration-300 ease-in-out"
     [class.minimized]="isMinimized">
```

**Content với fade + collapse:**
```html
<!-- Title/buttons hidden when minimized -->
<div class="flex-1 flex items-center justify-between transition-all duration-300"
     [class.opacity-0]="isMinimized"
     [class.w-0]="isMinimized"
     [class.overflow-hidden]="isMinimized">

<!-- Progress info hidden when minimized -->
<div class="sync-info transition-all duration-300 overflow-hidden"
     [class.max-h-0]="isMinimized"
     [class.opacity-0]="isMinimized">
```

### 4. **SCSS Styling:**

**Minimized State:**
```scss
.sync-widget {
  &.minimized {
    min-width: auto;
    width: 50px;
    height: 50px;
    padding: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%; // Circular shape
    
    .sync-header {
      margin-bottom: 0;
      
      ion-icon {
        font-size: 24px; // Larger icon when minimized
      }
    }
  }
}
```

**Button Styling:**
```scss
.close-btn,
.minimize-btn {
  --padding-start: 4px;
  --padding-end: 4px;
  --color: var(--ion-color-medium-shade);
}

.minimize-btn {
  --color: var(--ion-color-primary); // Blue color for minimize
}
```

### 5. **Tailwind-like Utilities:**
```scss
.transition-all { transition: all 0.3s ease-in-out; }
.duration-300 { transition-duration: 300ms; }
.ease-in-out { transition-timing-function: ease-in-out; }
.max-h-0 { max-height: 0; }
.opacity-0 { opacity: 0; }
.overflow-hidden { overflow: hidden; }
.cursor-pointer { cursor: pointer; }
```

## 🎨 **UI/UX Features:**

### ✅ **Minimized State:**
- 📦 **Compact**: 50x50px circular widget
- 🎯 **Icon Only**: Chỉ hiển thị status icon
- 👆 **Clickable**: Click icon để expand lại
- 🌈 **Status Colors**: Vẫn giữ màu theo trạng thái

### ✅ **Expanded State:**
- 📋 **Full Info**: Title, progress, buttons đầy đủ
- ➖ **Minimize Button**: Dấu `-` màu xanh
- ❌ **Close Button**: Dấu `x` màu xám
- 📊 **Progress Bar**: ng-zorro progress hiển thị

### ✅ **Smooth Animations:**
- 🔄 **Size Transition**: Widget smooth resize
- 👻 **Fade Effect**: Content fade in/out
- ⚡ **Fast**: 300ms duration
- 🎭 **Easing**: ease-in-out timing

## 📱 **Responsive Design:**
- 📱 **Mobile**: Minimized vẫn 50px, dễ touch
- 💻 **Desktop**: Hover effects hoạt động tốt
- 🎯 **Accessibility**: Button có size đủ lớn để tap

## 🚀 **Benefits:**

### ✅ **Better UX:**
- **Space Saving**: User có thể thu gọn khi không cần xem
- **Always Accessible**: Status icon vẫn visible
- **Quick Access**: 1-click để expand/minimize
- **Non-intrusive**: Không che content quan trọng

### ✅ **Professional Look:**
- **Smooth Animations**: Polish và modern
- **Consistent Design**: Follow Ionic/ng-zorro patterns  
- **Tailwind CSS**: Clean utility-first approach
- **Responsive**: Works trên mọi device size

## 🎯 **Usage Flow:**
1. **Normal**: Widget hiển thị full với progress
2. **Click minimize (-)**: Thu gọn thành icon tròn
3. **Click icon**: Expand lại full widget
4. **Click close (x)**: Ẩn hoàn toàn widget

Perfect! Widget bây giờ có minimize functionality với smooth animation! 🎉