import os
import time
import requests
from urllib.parse import urlparse, urljoin
from bs4 import BeautifulSoup

# 配置
OUTPUT_DIR = "ICONS-ico"
USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"

# 创建输出目录
os.makedirs(OUTPUT_DIR, exist_ok=True)

# 支持的favicon名称和路径
FAVICON_PATHS = [
    "/favicon.ico",
    "/favicon.png",
    "/favicon.jpg",
    "/favicon.gif",
    "/favicon.svg",
    "/apple-touch-icon.png",
    "/apple-touch-icon-precomposed.png",
    "/static/favicon.ico",
    "/static/favicon.png",
    "/assets/favicon.ico",
    "/assets/favicon.png",
    "/images/favicon.ico",
    "/images/favicon.png"
]

# 支持的图片格式
SUPPORTED_IMAGE_FORMATS = ['.ico', '.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp']

def get_base_url(domain):
    """
    获取网站的基础URL
    """
    if not domain.startswith(('http://', 'https://')):
        domain = f"https://{domain}"
    parsed = urlparse(domain)
    return f"{parsed.scheme}://{parsed.netloc}"

def generate_favicon_urls(domain):
    """
    生成多种可能的favicon URL
    :param domain: 域名
    :return: favicon URL列表
    """
    base_url = get_base_url(domain)
    urls = []
    
    # 生成所有可能的favicon路径
    for path in FAVICON_PATHS:
        urls.append(urljoin(base_url, path))
    
    return urls

def find_favicon_in_html(domain):
    """
    从HTML页面的<link>标签中查找favicon
    :param domain: 域名
    :return: favicon URL或None
    """
    try:
        base_url = get_base_url(domain)
        headers = {"User-Agent": USER_AGENT}
        response = requests.get(base_url, headers=headers, timeout=15, allow_redirects=True)
        response.raise_for_status()
        
        # 解析HTML
        soup = BeautifulSoup(response.text, 'html.parser')
        
        # 查找link标签中的favicon
        favicon_links = soup.find_all('link', rel=lambda x: x and ('icon' in x.lower() or 'shortcut' in x.lower()))
        
        for link in favicon_links:
            href = link.get('href')
            if href:
                # 构建完整URL
                favicon_url = urljoin(base_url, href)
                # 检查是否为图片格式
                if any(favicon_url.lower().endswith(ext) for ext in SUPPORTED_IMAGE_FORMATS):
                    return favicon_url
        
        return None
    except Exception as e:
        print(f"[HTML解析] 无法从HTML中提取favicon ({domain}): {e}")
        return None

def fetch_favicon(domain):
    """
    抓取单个网站的favicon，尝试多种策略
    """
    try:
        print(f"\n=== 开始抓取: {domain} ===")
        
        # 策略1: 从HTML中查找favicon
        print("策略1: 从HTML中查找favicon")
        html_favicon_url = find_favicon_in_html(domain)
        if html_favicon_url:
            print(f"✓ 从HTML中找到: {html_favicon_url}")
            if fetch_favicon_by_url(domain, html_favicon_url):
                return True
        
        # 策略2: 尝试多种可能的favicon URL
        print("策略2: 尝试多种可能的favicon URL")
        favicon_urls = generate_favicon_urls(domain)
        
        for favicon_url in favicon_urls:
            print(f"尝试: {favicon_url}")
            if fetch_favicon_by_url(domain, favicon_url):
                return True
        
        # 所有策略都失败
        print(f"✗ 所有策略均失败，无法找到 {domain} 的favicon")
        return False
        
    except KeyboardInterrupt:
        print(f"\n✗ 抓取被用户中断 ({domain})")
        return False
    except Exception as e:
        print(f"✗ 抓取过程中发生未知错误 ({domain}): {e}")
        return False

def fetch_favicon_by_url(domain, favicon_url):
    """
    通过URL抓取单个favicon
    :param domain: 域名
    :param favicon_url: favicon URL
    :return: 成功返回True，失败返回False
    """
    try:
        # 发送请求
        headers = {"User-Agent": USER_AGENT}
        response = requests.get(favicon_url, headers=headers, timeout=15, allow_redirects=True)
        response.raise_for_status()
        
        # 检查响应内容是否为空
        if not response.content or len(response.content) < 10:  # 检查最小文件大小
            print(f"  ✗ 响应内容为空或过小")
            return False
        
        # 检查内容类型
        content_type = response.headers.get('Content-Type', '')
        if 'image' not in content_type and 'icon' not in content_type:
            print(f"  ✗ 响应内容不是图片类型，实际类型: {content_type}")
            return False
        
        # 获取文件名
        parsed = urlparse(domain)
        
        # 健壮的文件名生成逻辑
        netloc = parsed.netloc
        if not netloc:
            # 如果netloc为空，尝试从domain中提取
            if domain.startswith(('http://', 'https://')):
                # 去掉协议
                domain_without_protocol = domain.split('://')[1]
                # 去掉路径部分
                domain_name = domain_without_protocol.split('/')[0]
            else:
                # 直接使用domain，去掉可能的路径部分
                domain_name = domain.split('/')[0]
        else:
            domain_name = netloc
        
        # 处理特殊字符，替换为下划线
        safe_domain_name = domain_name.replace(':', '_').replace('/', '_').replace('\\', '_')
        # 移除www.前缀
        safe_domain_name = safe_domain_name.replace('www.', '')
        # 确保文件名有效
        if not safe_domain_name:
            safe_domain_name = f"favicon_{int(time.time())}"
        
        # 根据实际文件格式获取扩展名
        file_ext = '.ico'  # 默认扩展名
        # 从URL获取扩展名
        url_ext = os.path.splitext(favicon_url)[1].lower()
        if url_ext in SUPPORTED_IMAGE_FORMATS:
            file_ext = url_ext
        # 或从Content-Type获取扩展名
        elif 'png' in content_type:
            file_ext = '.png'
        elif 'jpeg' in content_type or 'jpg' in content_type:
            file_ext = '.jpg'
        elif 'gif' in content_type:
            file_ext = '.gif'
        elif 'svg' in content_type:
            file_ext = '.svg'
        elif 'webp' in content_type:
            file_ext = '.webp'
        
        filename = f"{safe_domain_name}{file_ext}"
        filepath = os.path.join(OUTPUT_DIR, filename)
        
        # 保存文件
        with open(filepath, "wb") as f:
            f.write(response.content)
        
        # 验证文件是否成功保存且不为空
        if os.path.exists(filepath) and os.path.getsize(filepath) > 0:
            file_size = os.path.getsize(filepath)
            print(f"  ✓ 成功保存: {filepath} (大小: {file_size} 字节)")
            return True
        else:
            # 如果文件为空，删除它
            if os.path.exists(filepath):
                os.remove(filepath)
                print(f"  ✗ 文件保存失败或为空，已删除")
            else:
                print(f"  ✗ 文件保存失败")
            return False
        
    except requests.exceptions.HTTPError as e:
        print(f"  ✗ HTTP错误: {e.response.status_code} - {e.response.reason}")
        return False
    except requests.exceptions.ConnectionError:
        print(f"  ✗ 连接错误: 无法连接到服务器")
        return False
    except requests.exceptions.Timeout:
        print(f"  ✗ 超时错误: 请求超时")
        return False
    except requests.exceptions.TooManyRedirects:
        print(f"  ✗ 重定向错误: 重定向次数过多")
        return False
    except requests.exceptions.RequestException as e:
        print(f"  ✗ 请求错误: {e}")
        return False
    except Exception as e:
        print(f"  ✗ 未知错误: {e}")
        # 清理可能存在的空文件
        try:
            parsed = urlparse(domain)
            domain_name = parsed.netloc or domain.split('/')[0]
            safe_domain_name = domain_name.replace(':', '_').replace('/', '_').replace('\\', '_').replace('www.', '')
            if not safe_domain_name:
                safe_domain_name = f"favicon_{int(time.time())}"
            filepath = os.path.join(OUTPUT_DIR, f"{safe_domain_name}.ico")
            if os.path.exists(filepath) and os.path.getsize(filepath) == 0:
                os.remove(filepath)
                print(f"  ✗ 已清理空文件: {filepath}")
        except:
            pass
        return False

def fetch_from_file(file_path):
    """
    从文件中读取域名列表并抓取favicon
    """
    if not os.path.exists(file_path):
        print(f"✗ 文件不存在: {file_path}")
        return
    
    with open(file_path, "r", encoding="utf-8") as f:
        domains = [line.strip() for line in f if line.strip()]
    
    print(f"\n开始批量抓取，共 {len(domains)} 个域名")
    
    success_count = 0
    fail_count = 0
    
    for domain in domains:
        if fetch_favicon(domain):
            success_count += 1
        else:
            fail_count += 1
    
    print(f"\n批量抓取完成")
    print(f"成功: {success_count}")
    print(f"失败: {fail_count}")
    print(f"总域名: {len(domains)}")

def main():
    """
    主函数
    """
    print("=== Favicon.ico 抓取工具 ===")
    print(f"输出目录: {OUTPUT_DIR}")
    print()
    
    try:
        while True:
            # 获取用户输入
            print("请选择操作:")
            print("1. 抓取单个网站的favicon (循环模式)")
            print("2. 从文件批量抓取favicon")
            print("3. 退出")
            
            choice = input("请输入选项 (1-3): ").strip()
            
            if choice == "1":
                print("\n=== 进入单个网站抓取模式 ===")
                print("提示: 输入网站域名进行抓取，输入 'q' 或 'Q' 退出此模式")
                print()
                
                while True:
                    domain = input("请输入网站域名 (如: www.baidu.com 或 baidu.com): ").strip()
                    
                    if domain.lower() == 'q':
                        print("\n=== 退出单个网站抓取模式 ===")
                        print()
                        break
                    
                    if domain:
                        fetch_favicon(domain)
                    else:
                        print("✗ 域名不能为空，请重新输入")
                    print()
            
            elif choice == "2":
                file_path = input("请输入包含域名的文件路径 (每行一个域名): ").strip()
                if file_path:
                    fetch_from_file(file_path)
                print()
            
            elif choice == "3":
                print("退出程序")
                return
            
            else:
                print("✗ 无效选项，请重新输入")
                print()
    
    except KeyboardInterrupt:
        print("\n\n✗ 程序被用户中断 (Ctrl+C)")
        print("=== 操作完成 ===")
    
    print()
    print("=== 操作完成 ===")

if __name__ == "__main__":
    main()
